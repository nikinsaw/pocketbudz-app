import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../db.js';
import { CONSENT_VERSION, createHouseholdService } from './service.js';
import { makeHousehold, makeUser, resetDb } from './testUtils.js';

const service = createHouseholdService(prisma);

beforeEach(() => resetDb(prisma));
afterAll(() => prisma.$disconnect());

describe('leave', () => {
  it('anonymises a leaving spender and keeps their history row', async () => {
    const owner = await makeUser(prisma, 'owner');
    const spender = await makeUser(prisma, 'spender');
    const household = await makeHousehold(prisma, [
      { userId: owner.id, role: 'OWNER' },
      { userId: spender.id, role: 'SPENDER' },
    ]);
    const membership = household.members.find((m) => m.userId === spender.id)!;
    await prisma.transaction.create({
      data: { householdId: household.id, memberId: membership.id, merchant: 'Cafe', category: 'Food', amount: 25000, date: new Date('2026-10-01') },
    });

    expect(await service.leave(spender.id, household.id)).toEqual({ householdDeleted: false });

    const kept = await prisma.membership.findUniqueOrThrow({ where: { id: membership.id } });
    expect(kept.userId).toBeNull();
    expect(kept.leftAt).not.toBeNull();
    expect(await prisma.transaction.count({ where: { memberId: membership.id } })).toBe(1);
    expect(await service.listMine(spender.id)).toHaveLength(0);
    const names = (await service.listMembers(owner.id, household.id)).map((m) => m.name);
    expect(names).toEqual(['owner']);
  });

  it('lets a former member join a household again', async () => {
    const owner = await makeUser(prisma, 'owner');
    const spender = await makeUser(prisma, 'spender');
    const household = await makeHousehold(prisma, [
      { userId: owner.id, role: 'OWNER' },
      { userId: spender.id, role: 'SPENDER' },
    ]);
    await service.leave(spender.id, household.id);
    const { code } = await service.createInvite(owner.id, household.id, 'SPENDER');
    await expect(
      service.join(spender.id, { code, consentVersion: CONSENT_VERSION }),
    ).resolves.toMatchObject({ role: 'SPENDER' });
  });

  it('blocks a sole owner from leaving while others remain', async () => {
    const owner = await makeUser(prisma, 'owner');
    const spender = await makeUser(prisma, 'spender');
    const household = await makeHousehold(prisma, [
      { userId: owner.id, role: 'OWNER' },
      { userId: spender.id, role: 'SPENDER' },
    ]);
    await expect(service.leave(owner.id, household.id)).rejects.toMatchObject({ status: 409 });
  });

  it('deletes the household when the last member leaves', async () => {
    const owner = await makeUser(prisma, 'owner');
    const household = await makeHousehold(prisma, [{ userId: owner.id, role: 'OWNER' }]);
    expect(await service.leave(owner.id, household.id)).toEqual({ householdDeleted: true });
    expect(await prisma.household.count()).toBe(0);
  });

  it('404s for a non-member', async () => {
    const owner = await makeUser(prisma, 'owner');
    const outsider = await makeUser(prisma, 'outsider');
    const household = await makeHousehold(prisma, [{ userId: owner.id, role: 'OWNER' }]);
    await expect(service.leave(outsider.id, household.id)).rejects.toMatchObject({ status: 404 });
  });
});
