import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../db.js';
import { makeHousehold, makeUser, resetDb } from '../households/testUtils.js';
import { effectiveLevel, levelsForOwner, ownersVisibleAt } from './resolve.js';

const earner = { id: 'e1', role: 'EARNER' as const };
const spender = { id: 's1', role: 'SPENDER' as const };

describe('effectiveLevel', () => {
  it('defaults: earners see totals, other spenders see nothing', () => {
    expect(effectiveLevel([], earner)).toBe('TOTAL');
    expect(effectiveLevel([], { id: 'o', role: 'OWNER' })).toBe('TOTAL');
    expect(effectiveLevel([], spender)).toBe('NONE');
  });

  it('uses the everyone grant when there is no specific one', () => {
    const grants = [{ viewerId: null, level: 'FULL' as const }];
    expect(effectiveLevel(grants, earner)).toBe('FULL');
    expect(effectiveLevel(grants, spender)).toBe('FULL');
  });

  it('lets a specific grant override the everyone grant, both ways', () => {
    const grants = [
      { viewerId: null, level: 'FULL' as const },
      { viewerId: 's1', level: 'NONE' as const },
      { viewerId: 'e1', level: 'TOTAL' as const },
    ];
    expect(effectiveLevel(grants, spender)).toBe('NONE');
    expect(effectiveLevel(grants, earner)).toBe('TOTAL');
  });

  it('never drops an earner below TOTAL', () => {
    expect(effectiveLevel([{ viewerId: null, level: 'NONE' }], earner)).toBe('TOTAL');
    expect(effectiveLevel([{ viewerId: 'e1', level: 'NONE' }], earner)).toBe('TOTAL');
    expect(effectiveLevel([{ viewerId: null, level: 'NONE' }], spender)).toBe('NONE');
  });
});

describe('with a real household', () => {
  beforeEach(() => resetDb(prisma));
  afterAll(() => prisma.$disconnect());

  async function setup() {
    const owner = await makeUser(prisma, 'owner');
    const spender = await makeUser(prisma, 'spender');
    const spender2 = await makeUser(prisma, 'spender2');
    const household = await makeHousehold(prisma, [
      { userId: owner.id, role: 'OWNER' },
      { userId: spender.id, role: 'SPENDER' },
      { userId: spender2.id, role: 'SPENDER' },
    ]);
    const m = (userId: string) => household.members.find((x) => x.userId === userId)!;
    return { household, owner: m(owner.id), spender: m(spender.id), spender2: m(spender2.id) };
  }

  it('levelsForOwner covers every other active member and skips leavers', async () => {
    const { owner, spender, spender2 } = await setup();
    await prisma.visibilityGrant.create({ data: { ownerId: spender.id, viewerId: spender2.id, level: 'FULL' } });
    await prisma.membership.update({ where: { id: owner.id }, data: { leftAt: new Date(), userId: null } });
    const levels = await levelsForOwner(prisma, spender);
    expect(levels).toEqual([{ viewerId: spender2.id, level: 'FULL' }]);
  });

  it('ownersVisibleAt returns only owners who share enough with the viewer', async () => {
    const { household, owner, spender, spender2 } = await setup();
    await prisma.visibilityGrant.create({ data: { ownerId: spender.id, viewerId: owner.id, level: 'FULL' } });
    const fullToOwner = await ownersVisibleAt(prisma, household.id, owner, 'FULL');
    expect([...fullToOwner]).toEqual([spender.id]);
    const totalToOwner = await ownersVisibleAt(prisma, household.id, owner, 'TOTAL');
    expect(totalToOwner).toEqual(new Set([spender.id, spender2.id]));
  });
});
