import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../db.js';
import { createHouseholdService } from '../households/service.js';
import { makeHousehold, makeUser, resetDb } from '../households/testUtils.js';
import { createAllowanceService } from './service.js';

const service = createAllowanceService(prisma);

beforeEach(() => resetDb(prisma));
afterAll(() => prisma.$disconnect());

async function setup() {
  const owner = await makeUser(prisma, 'owner');
  const earner = await makeUser(prisma, 'earner');
  const spender = await makeUser(prisma, 'spender');
  const spender2 = await makeUser(prisma, 'spender2');
  const household = await makeHousehold(prisma, [
    { userId: owner.id, role: 'OWNER' },
    { userId: earner.id, role: 'EARNER' },
    { userId: spender.id, role: 'SPENDER' },
    { userId: spender2.id, role: 'SPENDER' },
  ]);
  const m = (userId: string) => household.members.find((x) => x.userId === userId)!;
  return { owner, earner, spender, spender2, household, mOwner: m(owner.id), mEarner: m(earner.id), mSpender: m(spender.id), mSpender2: m(spender2.id) };
}

describe('set', () => {
  it('lets an earner set aside money for a spender, and replaces it on a second set', async () => {
    const { owner, household, mSpender } = await setup();
    await service.set(owner.id, household.id, mSpender.id, 200000);
    await service.set(owner.id, household.id, mSpender.id, 250000);
    expect(await prisma.allowance.count()).toBe(1);
    expect((await service.list(owner.id, household.id)).total).toBe(250000);
  });

  it('keeps allowances from different earners separate and adds them up for the spender', async () => {
    const { owner, earner, spender, household, mSpender } = await setup();
    await service.set(owner.id, household.id, mSpender.id, 200000);
    await service.set(earner.id, household.id, mSpender.id, 100000);
    const seen = await service.list(spender.id, household.id);
    expect(seen.total).toBe(300000);
    expect(seen.allowances.map((a) => a.from).sort()).toEqual(['earner', 'owner']);
  });

  it('forbids spenders, self-allowances, earner recipients and unknown members', async () => {
    const { owner, spender, household, mOwner, mEarner, mSpender2 } = await setup();
    await expect(service.set(spender.id, household.id, mSpender2.id, 100)).rejects.toMatchObject({ status: 403 });
    await expect(service.set(owner.id, household.id, mOwner.id, 100)).rejects.toMatchObject({ status: 400 });
    await expect(service.set(owner.id, household.id, mEarner.id, 100)).rejects.toMatchObject({ status: 400 });
    await expect(service.set(owner.id, household.id, 'nope', 100)).rejects.toMatchObject({ status: 404 });
  });

  it('404s for non-members and cross-household recipients', async () => {
    const { owner, household } = await setup();
    const outsider = await makeUser(prisma, 'outsider');
    const other = await makeHousehold(prisma, [{ userId: outsider.id, role: 'OWNER' }, { userId: (await makeUser(prisma, 'x')).id, role: 'SPENDER' }]);
    await expect(service.set(outsider.id, household.id, 'x', 1)).rejects.toMatchObject({ status: 404 });
    await expect(service.set(owner.id, household.id, other.members[1].id, 1)).rejects.toMatchObject({ status: 404 });
  });
});

describe('list / remove', () => {
  it('shows a spender only their own allowances, earners everything', async () => {
    const { owner, spender, spender2, household, mSpender, mSpender2 } = await setup();
    await service.set(owner.id, household.id, mSpender.id, 200000);
    await service.set(owner.id, household.id, mSpender2.id, 50000);
    expect((await service.list(spender.id, household.id)).allowances).toHaveLength(1);
    expect((await service.list(spender.id, household.id)).total).toBe(200000);
    expect((await service.list(owner.id, household.id)).allowances).toHaveLength(2);
  });

  it('only the setter can remove it', async () => {
    const { owner, earner, household, mSpender } = await setup();
    await service.set(owner.id, household.id, mSpender.id, 200000);
    await expect(service.remove(earner.id, household.id, mSpender.id)).rejects.toMatchObject({ status: 404 });
    await service.remove(owner.id, household.id, mSpender.id);
    expect((await service.list(owner.id, household.id)).total).toBe(0);
  });
});

describe('leaving', () => {
  it('drops allowances to and from a member who leaves', async () => {
    const { owner, spender, household, mSpender } = await setup();
    await service.set(owner.id, household.id, mSpender.id, 200000);
    await createHouseholdService(prisma).leave(spender.id, household.id);
    expect(await prisma.allowance.count()).toBe(0);
  });
});
