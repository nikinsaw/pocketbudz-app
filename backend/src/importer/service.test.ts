import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../db.js';
import { makeHousehold, makeUser, resetDb } from '../households/testUtils.js';
import { createTransactionService } from '../transactions/service.js';
import { createVisibilityService } from '../visibility/service.js';
import { createImportService, type SoloData } from './service.js';

const service = createImportService(prisma);
const transactions = createTransactionService(prisma);
const visibility = createVisibilityService(prisma);

const solo = (overrides: Partial<SoloData> = {}): SoloData => ({
  envelopeScope: 'PERSONAL',
  monthlyIncome: 50000,
  envelopes: [
    { categoryKey: 'food', icon: '🍕', title: 'Food', colorKey: 'food', type: 'spending', budgetLimit: 8000.5 },
    { categoryKey: 'rent', icon: '🏠', title: 'Rent', colorKey: 'rent', type: 'fixed', budgetLimit: 15000 },
  ],
  transactions: [
    { merchant: 'Blue Tokai', category: 'food', amount: 199.99, date: '2026-10-02' }, // case-insensitive match
    { merchant: 'Landlord', category: 'Rent', amount: 15000, date: '2026-10-01' },
    { merchant: 'Mystery', category: 'Gadgets', amount: 500, date: '2026-10-03' }, // no envelope
  ],
  ...overrides,
});

beforeEach(() => resetDb(prisma));
afterAll(() => prisma.$disconnect());

async function setup() {
  const owner = await makeUser(prisma, 'owner');
  const spender = await makeUser(prisma, 'spender');
  const household = await makeHousehold(prisma, [
    { userId: owner.id, role: 'OWNER' },
    { userId: spender.id, role: 'SPENDER' },
  ]);
  const m = (userId: string) => household.members.find((x) => x.userId === userId)!;
  return { owner, spender, household, mOwner: m(owner.id), mSpender: m(spender.id) };
}

describe('importSolo as a spender', () => {
  it('creates personal envelopes, converts rupees to paise and matches transactions to envelopes', async () => {
    const { spender, household, mSpender } = await setup();
    const result = await service.importSolo(spender.id, household.id, solo());
    expect(result).toEqual({ envelopes: 2, transactions: 3, incomeImported: false });

    const envelopes = await prisma.envelope.findMany({ orderBy: { title: 'asc' } });
    expect(envelopes.map((e) => [e.title, e.scope, e.ownerId, e.budgetLimit])).toEqual([
      ['Food', 'PERSONAL', mSpender.id, 800050],
      ['Rent', 'PERSONAL', mSpender.id, 1500000],
    ]);
    const rows = await prisma.transaction.findMany({ orderBy: { merchant: 'asc' }, include: { envelope: true } });
    expect(rows.map((t) => [t.merchant, t.amount, t.envelope?.title ?? null, t.memberId])).toEqual([
      ['Blue Tokai', 19999, 'Food', mSpender.id],
      ['Landlord', 1500000, 'Rent', mSpender.id],
      ['Mystery', 50000, null, mSpender.id],
    ]);
  });

  it("ignores monthly income (spenders don't hold income) and stamps private spending like normal adds", async () => {
    const { owner, spender, household, mOwner } = await setup();
    await visibility.set(spender.id, household.id, mOwner.id, 'FULL');
    await service.importSolo(spender.id, household.id, solo());
    expect(await prisma.incomeSource.count()).toBe(0);
    // All three are private (personal envelope or none) and the owner was shared FULL.
    expect(await prisma.transactionVisibility.count({ where: { viewerId: mOwner.id, level: 'FULL' } })).toBe(3);
    expect(await transactions.list(owner.id, household.id)).toHaveLength(3);
  });

  it('by default an earner sees only the total of imported private spending', async () => {
    const { owner, spender, household } = await setup();
    await service.importSolo(spender.id, household.id, solo());
    expect(await transactions.list(owner.id, household.id)).toHaveLength(0);
    const seen = (await visibility.spending(owner.id, household.id)).find((r) => r.name === 'spender')!;
    expect(seen).toMatchObject({ privateSpent: 19999 + 1500000 + 50000, itemisedSpent: 0 });
  });

  it('refuses to import shared envelopes', async () => {
    const { spender, household } = await setup();
    await expect(
      service.importSolo(spender.id, household.id, solo({ envelopeScope: 'SHARED' })),
    ).rejects.toMatchObject({ status: 403 });
    expect(await prisma.envelope.count()).toBe(0);
  });
});

describe('importSolo as an earner', () => {
  it('imports shared envelopes (visible to all, never stamped) and monthly income', async () => {
    const { owner, spender, household } = await setup();
    const result = await service.importSolo(owner.id, household.id, solo({ envelopeScope: 'SHARED' }));
    expect(result.incomeImported).toBe(true);
    expect(await prisma.incomeSource.findMany()).toMatchObject([{ amount: 5000000, label: 'Monthly income (imported)' }]);
    expect((await transactions.list(spender.id, household.id)).map((t) => t.merchant).sort()).toEqual(['Blue Tokai', 'Landlord']);
    // The unmatched "Mystery" transaction is private to the importer.
    expect(await prisma.transactionVisibility.count({ where: { transaction: { merchant: 'Blue Tokai' } } })).toBe(0);
  });
});

describe('importSolo safety', () => {
  it('only works once per member, including under a double submit', async () => {
    const { spender, household } = await setup();
    const results = await Promise.allSettled([
      service.importSolo(spender.id, household.id, solo()),
      service.importSolo(spender.id, household.id, solo()),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await prisma.transaction.count()).toBe(3);
    await expect(service.importSolo(spender.id, household.id, solo())).rejects.toMatchObject({ status: 409 });
  });

  it('is all-or-nothing: a bad row aborts the import and the member can retry', async () => {
    const { spender, household } = await setup();
    const bad = solo({
      transactions: [
        { merchant: 'Fine', category: 'Food', amount: 10, date: '2026-10-02' },
        { merchant: 'Broken', category: 'Food', amount: 10, date: '2026-02-31' },
      ],
    });
    await expect(service.importSolo(spender.id, household.id, bad)).rejects.toMatchObject({ status: 400 });
    expect(await prisma.envelope.count()).toBe(0);
    expect(await prisma.transaction.count()).toBe(0);
    expect((await prisma.membership.findFirstOrThrow({ where: { userId: spender.id } })).importedAt).toBeNull();
    await expect(service.importSolo(spender.id, household.id, solo())).resolves.toMatchObject({ transactions: 3 });
  });

  it('rejects amounts that would round to zero or overflow', async () => {
    const { spender, household } = await setup();
    const tiny = solo({ transactions: [{ merchant: 'x', category: 'y', amount: 0.001, date: '2026-10-02' }] });
    await expect(service.importSolo(spender.id, household.id, tiny)).rejects.toMatchObject({ status: 400 });
    const huge = solo({ transactions: [{ merchant: 'x', category: 'y', amount: 50_000_000, date: '2026-10-02' }] });
    await expect(service.importSolo(spender.id, household.id, huge)).rejects.toMatchObject({ status: 400 });
    expect(await prisma.transaction.count()).toBe(0);
  });

  it('404s for non-members', async () => {
    const { household } = await setup();
    const outsider = await makeUser(prisma, 'outsider');
    await expect(service.importSolo(outsider.id, household.id, solo())).rejects.toMatchObject({ status: 404 });
  });

  it('handles a realistic volume in one go', async () => {
    const { spender, household } = await setup();
    const many = solo({
      transactions: Array.from({ length: 3000 }, (_, i) => ({
        merchant: `Shop ${i}`, category: i % 2 ? 'Food' : 'Rent', amount: 10 + (i % 90), date: '2026-10-02',
      })),
    });
    const started = Date.now();
    await expect(service.importSolo(spender.id, household.id, many)).resolves.toMatchObject({ transactions: 3000 });
    expect(Date.now() - started).toBeLessThan(20_000);
    expect(await prisma.transaction.count()).toBe(3000);
  });
});
