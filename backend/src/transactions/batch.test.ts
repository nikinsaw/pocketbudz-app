import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../db.js';
import { createEnvelopeService } from '../envelopes/service.js';
import { makeHousehold, makeUser, resetDb } from '../households/testUtils.js';
import { createVisibilityService } from '../visibility/service.js';
import { createTransactionService } from './service.js';

const service = createTransactionService(prisma);
const envelopes = createEnvelopeService(prisma);
const visibility = createVisibilityService(prisma);
const envFields = (title: string) => ({ categoryKey: title, icon: 'x', title, colorKey: 'c', type: 'spending', budgetLimit: 100000 });
const tx = (merchant: string, amount = 1000, extra: Record<string, unknown> = {}) => ({
  envelopeId: null, merchant, category: 'Food', amount, date: '2026-10-05', ...extra,
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
  const shared = await envelopes.create(owner.id, household.id, { ...envFields('Food'), scope: 'SHARED' });
  const mOwner = household.members.find((m) => m.userId === owner.id)!;
  return { owner, spender, household, shared, mOwner };
}

describe('createMany', () => {
  it('adds them all, newest first, attributed to the caller', async () => {
    const { spender, household } = await setup();
    const created = await service.createMany(spender.id, household.id, [
      tx('A', 100, { date: '2026-10-01' }), tx('B', 200, { date: '2026-10-09' }), tx('C', 300, { date: '2026-10-05' }),
    ]);
    expect(created.map((t) => t.merchant)).toEqual(['B', 'C', 'A']);
    expect(created.every((t) => t.mine)).toBe(true);
    expect(await prisma.transaction.count()).toBe(3);
  });

  it('is all-or-nothing: one unusable envelope means nothing is added', async () => {
    const { spender, owner, household, shared } = await setup();
    const theirs = await envelopes.create(owner.id, household.id, { ...envFields('Secret'), scope: 'PERSONAL' });
    await expect(
      service.createMany(spender.id, household.id, [tx('Ok', 100, { envelopeId: shared.id }), tx('Bad', 100, { envelopeId: theirs.id })]),
    ).rejects.toMatchObject({ status: 404 });
    expect(await prisma.transaction.count()).toBe(0);
  });

  it('is all-or-nothing for a bad date too', async () => {
    const { spender, household } = await setup();
    await expect(service.createMany(spender.id, household.id, [tx('Ok'), tx('Bad', 1, { date: '2026-02-31' })])).rejects.toMatchObject({ status: 400 });
    expect(await prisma.transaction.count()).toBe(0);
  });

  it('stamps only the private ones, from the spender’s current sharing settings', async () => {
    const { spender, household, shared, mOwner } = await setup();
    await visibility.set(spender.id, household.id, mOwner.id, 'FULL');
    const created = await service.createMany(spender.id, household.id, [tx('Private'), tx('Shared', 100, { envelopeId: shared.id })]);
    const priv = created.find((t) => t.merchant === 'Private')!;
    const shr = created.find((t) => t.merchant === 'Shared')!;
    expect(await prisma.transactionVisibility.count({ where: { transactionId: priv.id, viewerId: mOwner.id, level: 'FULL' } })).toBe(1);
    expect(await prisma.transactionVisibility.count({ where: { transactionId: shr.id } })).toBe(0);
  });

  it('404s for non-members', async () => {
    const { household } = await setup();
    const outsider = await makeUser(prisma, 'outsider');
    await expect(service.createMany(outsider.id, household.id, [tx('x')])).rejects.toMatchObject({ status: 404 });
  });

  it('handles a large batch in one go', async () => {
    const { spender, household } = await setup();
    const many = Array.from({ length: 500 }, (_, i) => tx(`Shop ${i}`, 100 + i));
    const created = await service.createMany(spender.id, household.id, many);
    expect(created).toHaveLength(500);
    expect(await prisma.transaction.count()).toBe(500);
  }, 60_000);
});

describe('merge', () => {
  it('replaces the originals with one transaction carrying the combined values', async () => {
    const { spender, household } = await setup();
    const [a, b] = await service.createMany(spender.id, household.id, [tx('A', 100), tx('B', 200)]);
    const merged = await service.merge(spender.id, household.id, { ids: [a.id, b.id], ...tx('A + B', 300) });
    expect(merged).toMatchObject({ merchant: 'A + B', amount: 300, mine: true });
    const left = await prisma.transaction.findMany();
    expect(left.map((t) => t.id)).toEqual([merged.id]);
  });

  it('re-stamps the merged transaction when it stays private, and not when it moves into a shared envelope', async () => {
    const { spender, household, shared, mOwner } = await setup();
    await visibility.set(spender.id, household.id, mOwner.id, 'FULL');
    const [a, b] = await service.createMany(spender.id, household.id, [tx('A'), tx('B')]);
    const priv = await service.merge(spender.id, household.id, { ids: [a.id, b.id], ...tx('AB') });
    expect(await prisma.transactionVisibility.count({ where: { transactionId: priv.id } })).toBe(1);

    const [c, d] = await service.createMany(spender.id, household.id, [tx('C'), tx('D')]);
    const inShared = await service.merge(spender.id, household.id, { ids: [c.id, d.id], ...tx('CD', 5, { envelopeId: shared.id }) });
    expect(await prisma.transactionVisibility.count({ where: { transactionId: inShared.id } })).toBe(0);
  });

  it('cannot merge someone else’s spending, and changes nothing', async () => {
    const { owner, spender, household, shared } = await setup();
    const mine = await service.create(spender.id, household.id, tx('Mine', 100, { envelopeId: shared.id }));
    const theirs = await service.create(owner.id, household.id, tx('Theirs', 100, { envelopeId: shared.id }));
    await expect(service.merge(spender.id, household.id, { ids: [mine.id, theirs.id], ...tx('X') })).rejects.toMatchObject({ status: 403 });
    expect(await prisma.transaction.count()).toBe(2);
  });

  it('cannot merge spending it cannot see (private to someone else), and does not reveal it exists', async () => {
    const { owner, spender, household } = await setup();
    const mine = await service.create(spender.id, household.id, tx('Mine'));
    const hidden = await service.create(owner.id, household.id, tx('Hidden'));
    await expect(service.merge(spender.id, household.id, { ids: [mine.id, hidden.id], ...tx('X') })).rejects.toMatchObject({ status: 404 });
    expect(await prisma.transaction.count()).toBe(2);
  });

  it('404s for an unknown id, with nothing changed', async () => {
    const { spender, household } = await setup();
    const a = await service.create(spender.id, household.id, tx('A'));
    await expect(service.merge(spender.id, household.id, { ids: [a.id, 'nope'], ...tx('X') })).rejects.toMatchObject({ status: 404 });
    expect(await prisma.transaction.count()).toBe(1);
  });

  it('keeps the originals if the merged transaction cannot be created (unusable envelope)', async () => {
    const { owner, spender, household } = await setup();
    const theirs = await envelopes.create(owner.id, household.id, { ...envFields('Secret'), scope: 'PERSONAL' });
    const [a, b] = await service.createMany(spender.id, household.id, [tx('A'), tx('B')]);
    await expect(service.merge(spender.id, household.id, { ids: [a.id, b.id], ...tx('X', 5, { envelopeId: theirs.id }) })).rejects.toMatchObject({ status: 404 });
    expect(await prisma.transaction.count()).toBe(2);
  });

  it('rolls everything back if an original is deleted after the check but before the merge', async () => {
    const { spender, household } = await setup();
    const [a, b] = await service.createMany(spender.id, household.id, [tx('A'), tx('B')]);

    // A concurrent delete lands right after the server has looked the originals up.
    const realFindMany = prisma.transaction.findMany.bind(prisma.transaction);
    const spy = vi.spyOn(prisma.transaction, 'findMany').mockImplementationOnce(((args: never) =>
      realFindMany(args).then(async (rows) => {
        await prisma.transaction.delete({ where: { id: b.id } });
        return rows;
      })) as never);

    try {
      await expect(service.merge(spender.id, household.id, { ids: [a.id, b.id], ...tx('X', 300) })).rejects.toMatchObject({ status: 409 });
    } finally {
      spy.mockRestore();
    }
    // Rolled back: A is still there untouched, and no merged transaction appeared.
    const left = await prisma.transaction.findMany();
    expect(left.map((t) => t.id)).toEqual([a.id]);
    expect(left[0].merchant).toBe('A');
  });
});
