import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../db.js';
import { makeHousehold, makeUser, resetDb } from '../households/testUtils.js';
import { createEnvelopeService } from './service.js';

const service = createEnvelopeService(prisma);
const fields = {
  categoryKey: 'groceries', icon: '🛒', title: 'Groceries', colorKey: 'groceries', type: 'monthly', budgetLimit: 800000,
};

beforeEach(() => resetDb(prisma));
afterAll(() => prisma.$disconnect());

async function setup() {
  const owner = await makeUser(prisma, 'owner');
  const earner = await makeUser(prisma, 'earner');
  const spender = await makeUser(prisma, 'spender');
  const spender2 = await makeUser(prisma, 'spender2');
  const outsider = await makeUser(prisma, 'outsider');
  const household = await makeHousehold(prisma, [
    { userId: owner.id, role: 'OWNER' },
    { userId: earner.id, role: 'EARNER' },
    { userId: spender.id, role: 'SPENDER' },
    { userId: spender2.id, role: 'SPENDER' },
  ]);
  return { owner, earner, spender, spender2, outsider, household };
}

describe('create', () => {
  it('lets owners and earners create shared envelopes', async () => {
    const { owner, earner, household } = await setup();
    expect((await service.create(owner.id, household.id, { ...fields, scope: 'SHARED' })).ownerId).toBeNull();
    await expect(service.create(earner.id, household.id, { ...fields, scope: 'SHARED' })).resolves.toBeTruthy();
  });

  it('forbids spenders from creating shared envelopes', async () => {
    const { spender, household } = await setup();
    await expect(
      service.create(spender.id, household.id, { ...fields, scope: 'SHARED' }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('lets any member create a personal envelope that they own', async () => {
    const { spender, household } = await setup();
    const envelope = await service.create(spender.id, household.id, { ...fields, scope: 'PERSONAL' });
    const membership = household.members.find((m) => m.userId === spender.id)!;
    expect(envelope.ownerId).toBe(membership.id);
  });

  it('404s for non-members', async () => {
    const { outsider, household } = await setup();
    await expect(
      service.create(outsider.id, household.id, { ...fields, scope: 'SHARED' }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('list', () => {
  it('shows shared envelopes to all and personal only to their owner', async () => {
    const { owner, spender, spender2, household } = await setup();
    await service.create(owner.id, household.id, { ...fields, title: 'Rent', scope: 'SHARED' });
    await service.create(spender.id, household.id, { ...fields, title: 'Pocket money', scope: 'PERSONAL' });

    const titles = async (id: string) => (await service.list(id, household.id)).map((e) => e.title).sort();
    expect(await titles(spender.id)).toEqual(['Pocket money', 'Rent']);
    expect(await titles(spender2.id)).toEqual(['Rent']);
    expect(await titles(owner.id)).toEqual(['Rent']);
  });
});

describe('update / remove', () => {
  it('lets earners edit shared envelopes but not spenders', async () => {
    const { owner, earner, spender, household } = await setup();
    const shared = await service.create(owner.id, household.id, { ...fields, scope: 'SHARED' });
    const updated = await service.update(earner.id, household.id, shared.id, { budgetLimit: 900000 });
    expect(updated.budgetLimit).toBe(900000);
    await expect(
      service.update(spender.id, household.id, shared.id, { budgetLimit: 1 }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(service.remove(spender.id, household.id, shared.id)).rejects.toMatchObject({ status: 403 });
  });

  it("hides one member's personal envelope from everyone else, including the owner", async () => {
    const { owner, spender, household } = await setup();
    const personal = await service.create(spender.id, household.id, { ...fields, scope: 'PERSONAL' });
    await expect(
      service.update(owner.id, household.id, personal.id, { title: 'x' }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(service.remove(owner.id, household.id, personal.id)).rejects.toMatchObject({ status: 404 });
    await expect(service.remove(spender.id, household.id, personal.id)).resolves.toBeUndefined();
  });

  it("can't reach an envelope through another household", async () => {
    const { owner, household } = await setup();
    const other = await makeUser(prisma, 'other');
    const otherHome = await makeHousehold(prisma, [{ userId: other.id, role: 'OWNER' }]);
    const shared = await service.create(owner.id, household.id, { ...fields, scope: 'SHARED' });
    await expect(
      service.update(other.id, otherHome.id, shared.id, { title: 'x' }),
    ).rejects.toMatchObject({ status: 404 });
  });
});
