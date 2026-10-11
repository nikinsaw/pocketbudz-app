import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../db.js';
import { makeHousehold, makeUser, resetDb } from '../households/testUtils.js';
import { createEnvelopeService } from '../envelopes/service.js';
import { createTransactionService, parseDate } from './service.js';

const service = createTransactionService(prisma);
const envelopes = createEnvelopeService(prisma);
const envelopeFields = {
  categoryKey: 'food', icon: '🍕', title: 'Food', colorKey: 'food', type: 'monthly', budgetLimit: 500000,
};
const tx = { envelopeId: null, merchant: 'Cafe', category: 'Food', amount: 25000, date: '2026-10-05' };

beforeEach(() => resetDb(prisma));
afterAll(() => prisma.$disconnect());

async function setup() {
  const owner = await makeUser(prisma, 'owner');
  const spender = await makeUser(prisma, 'spender');
  const spender2 = await makeUser(prisma, 'spender2');
  const outsider = await makeUser(prisma, 'outsider');
  const household = await makeHousehold(prisma, [
    { userId: owner.id, role: 'OWNER' },
    { userId: spender.id, role: 'SPENDER' },
    { userId: spender2.id, role: 'SPENDER' },
  ]);
  const shared = await envelopes.create(owner.id, household.id, { ...envelopeFields, scope: 'SHARED' });
  return { owner, spender, spender2, outsider, household, shared };
}

describe('parseDate', () => {
  it('accepts real dates and rejects impossible ones', () => {
    expect(parseDate('2026-10-05').toISOString()).toBe('2026-10-05T00:00:00.000Z');
    expect(() => parseDate('2026-02-31')).toThrow();
    expect(() => parseDate('2026-13-01')).toThrow();
  });
});

describe('create', () => {
  it('records the transaction against the caller', async () => {
    const { spender, household, shared } = await setup();
    const created = await service.create(spender.id, household.id, { ...tx, envelopeId: shared.id });
    expect(created).toMatchObject({ amount: 25000, date: '2026-10-05', mine: true });
    expect(created.member.name).toBe('spender');
  });

  it("refuses someone else's personal envelope and other households' envelopes", async () => {
    const { spender, spender2, household } = await setup();
    const personal = await envelopes.create(spender.id, household.id, { ...envelopeFields, scope: 'PERSONAL' });
    await expect(
      service.create(spender2.id, household.id, { ...tx, envelopeId: personal.id }),
    ).rejects.toMatchObject({ status: 404 });

    const other = await makeUser(prisma, 'other');
    const otherHome = await makeHousehold(prisma, [{ userId: other.id, role: 'OWNER' }]);
    const foreign = await envelopes.create(other.id, otherHome.id, { ...envelopeFields, scope: 'SHARED' });
    await expect(
      service.create(spender.id, household.id, { ...tx, envelopeId: foreign.id }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('404s for non-members', async () => {
    const { outsider, household } = await setup();
    await expect(service.create(outsider.id, household.id, tx)).rejects.toMatchObject({ status: 404 });
  });
});

describe('list', () => {
  it('shows shared spending to everyone and keeps other spending private', async () => {
    const { owner, spender, spender2, household, shared } = await setup();
    await service.create(spender.id, household.id, { ...tx, merchant: 'Shared buy', envelopeId: shared.id });
    await service.create(spender.id, household.id, { ...tx, merchant: 'Private buy' });

    const merchants = async (id: string) =>
      (await service.list(id, household.id)).map((t) => t.merchant).sort();
    expect(await merchants(spender.id)).toEqual(['Private buy', 'Shared buy']);
    expect(await merchants(spender2.id)).toEqual(['Shared buy']);
    expect(await merchants(owner.id)).toEqual(['Shared buy']);
  });

  it('keeps a leaver\'s shared spending, anonymised', async () => {
    const { owner, spender, household, shared } = await setup();
    await service.create(spender.id, household.id, { ...tx, envelopeId: shared.id });
    await prisma.membership.updateMany({ where: { userId: spender.id }, data: { userId: null, leftAt: new Date() } });
    const [row] = await service.list(owner.id, household.id);
    expect(row.member.name).toBe('Former member');
  });

  it('filters by date range', async () => {
    const { spender, household } = await setup();
    for (const date of ['2026-09-30', '2026-10-05', '2026-10-20']) {
      await service.create(spender.id, household.id, { ...tx, date });
    }
    const rows = await service.list(spender.id, household.id, { from: '2026-10-01', to: '2026-10-31' });
    expect(rows.map((r) => r.date).sort()).toEqual(['2026-10-05', '2026-10-20']);
  });
});

describe('update / remove', () => {
  it('lets the creator change and delete their transaction', async () => {
    const { spender, household } = await setup();
    const created = await service.create(spender.id, household.id, tx);
    const updated = await service.update(spender.id, household.id, created.id, { amount: 30000 });
    expect(updated.amount).toBe(30000);
    await service.remove(spender.id, household.id, created.id);
    expect(await service.list(spender.id, household.id)).toHaveLength(0);
  });

  it("forbids changing someone else's shared transaction but hides private ones", async () => {
    const { owner, spender, household, shared } = await setup();
    const sharedTx = await service.create(spender.id, household.id, { ...tx, envelopeId: shared.id });
    const privateTx = await service.create(spender.id, household.id, tx);
    await expect(
      service.update(owner.id, household.id, sharedTx.id, { amount: 1 }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(service.remove(owner.id, household.id, privateTx.id)).rejects.toMatchObject({ status: 404 });
  });
});
