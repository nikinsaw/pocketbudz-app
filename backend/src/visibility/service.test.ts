import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../db.js';
import { makeHousehold, makeUser, resetDb } from '../households/testUtils.js';
import { createVisibilityService, EVERYONE } from './service.js';

const service = createVisibilityService(prisma);

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
  const m = (userId: string) => household.members.find((x) => x.userId === userId)!;
  return { household, outsider, spender, owner, spender2, mOwner: m(owner.id), mSpender2: m(spender2.id) };
}

describe('set', () => {
  it('shares with one member and shows it in the overview', async () => {
    const { household, spender, mOwner, mSpender2 } = await setup();
    await service.set(spender.id, household.id, mOwner.id, 'FULL');
    const overview = await service.overview(spender.id, household.id);
    expect(overview.everyone).toBeNull();
    const byId = Object.fromEntries(overview.members.map((m) => [m.membershipId, m]));
    expect(byId[mOwner.id]).toMatchObject({ explicit: 'FULL', effective: 'FULL' });
    expect(byId[mSpender2.id]).toMatchObject({ explicit: null, effective: 'NONE' });
  });

  it('updates in place rather than duplicating, including the everyone setting', async () => {
    const { household, spender, mOwner } = await setup();
    await service.set(spender.id, household.id, EVERYONE, 'TOTAL');
    await service.set(spender.id, household.id, EVERYONE, 'FULL');
    await service.set(spender.id, household.id, mOwner.id, 'TOTAL');
    await service.set(spender.id, household.id, mOwner.id, 'FULL');
    expect(await prisma.visibilityGrant.count()).toBe(2);
    expect((await service.overview(spender.id, household.id)).everyone).toBe('FULL');
  });

  it('database refuses a second everyone row for the same owner', async () => {
    const { spender, household } = await setup();
    await service.set(spender.id, household.id, EVERYONE, 'TOTAL');
    const owner = await prisma.membership.findFirstOrThrow({ where: { userId: spender.id } });
    await expect(
      prisma.visibilityGrant.create({ data: { ownerId: owner.id, viewerId: null, level: 'FULL' } }),
    ).rejects.toBeTruthy();
  });

  it('refuses to hide totals from an earner', async () => {
    const { household, spender, mOwner } = await setup();
    await expect(service.set(spender.id, household.id, mOwner.id, 'NONE')).rejects.toMatchObject({ status: 400 });
    // ...but "everyone: NONE" is fine; earners are floored at TOTAL when resolved.
    await service.set(spender.id, household.id, EVERYONE, 'NONE');
    const overview = await service.overview(spender.id, household.id);
    expect(overview.members.find((m) => m.membershipId === mOwner.id)!.effective).toBe('TOTAL');
  });

  it('rejects sharing with yourself, unknown members and other households', async () => {
    const { household, spender, owner } = await setup();
    const me = await prisma.membership.findFirstOrThrow({ where: { userId: spender.id } });
    await expect(service.set(spender.id, household.id, me.id, 'FULL')).rejects.toMatchObject({ status: 400 });
    await expect(service.set(spender.id, household.id, 'nope', 'FULL')).rejects.toMatchObject({ status: 404 });

    const other = await makeUser(prisma, 'other');
    const otherHome = await makeHousehold(prisma, [{ userId: other.id, role: 'OWNER' }]);
    const foreign = otherHome.members[0];
    await expect(service.set(spender.id, household.id, foreign.id, 'FULL')).rejects.toMatchObject({ status: 404 });
    expect(owner).toBeTruthy();
  });

  it('404s for non-members', async () => {
    const { household, outsider } = await setup();
    await expect(service.set(outsider.id, household.id, EVERYONE, 'FULL')).rejects.toMatchObject({ status: 404 });
    await expect(service.overview(outsider.id, household.id)).rejects.toMatchObject({ status: 404 });
  });
});

describe('reset', () => {
  it('returns a viewer to the default', async () => {
    const { household, spender, spender2, mSpender2 } = await setup();
    await service.set(spender.id, household.id, mSpender2.id, 'FULL');
    await service.reset(spender.id, household.id, mSpender2.id);
    const overview = await service.overview(spender.id, household.id);
    expect(overview.members.find((m) => m.membershipId === mSpender2.id)!.effective).toBe('NONE');
    expect(spender2).toBeTruthy();
  });

  it('clears the everyone setting', async () => {
    const { household, spender } = await setup();
    await service.set(spender.id, household.id, EVERYONE, 'FULL');
    await service.reset(spender.id, household.id, EVERYONE);
    expect((await service.overview(spender.id, household.id)).everyone).toBeNull();
  });
});
