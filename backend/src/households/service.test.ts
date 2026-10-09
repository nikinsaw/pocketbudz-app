import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../db.js';
import { CONSENT_VERSION, createHouseholdService } from './service.js';
import { makeHousehold, makeUser, resetDb } from './testUtils.js';

const service = createHouseholdService(prisma);

beforeEach(() => resetDb(prisma));
afterAll(() => prisma.$disconnect());

describe('create', () => {
  it('creates a household with the creator as owner and records consent', async () => {
    const user = await makeUser(prisma, 'asha');
    const household = await service.create(user.id, { name: 'Sharma family', consentVersion: CONSENT_VERSION });

    const membership = await prisma.membership.findFirstOrThrow({ where: { householdId: household.id } });
    expect(membership.userId).toBe(user.id);
    expect(membership.role).toBe('OWNER');
    const consent = await prisma.consentRecord.findFirstOrThrow({ where: { userId: user.id } });
    expect(consent.version).toBe(CONSENT_VERSION);
  });

  it('refuses without the current agreement version', async () => {
    const user = await makeUser(prisma, 'asha');
    await expect(
      service.create(user.id, { name: 'X', consentVersion: 'old' }),
    ).rejects.toMatchObject({ status: 400 });
    expect(await prisma.household.count()).toBe(0);
  });

  it('refuses a user who is already in a household', async () => {
    const user = await makeUser(prisma, 'asha');
    await service.create(user.id, { name: 'One', consentVersion: CONSENT_VERSION });
    await expect(
      service.create(user.id, { name: 'Two', consentVersion: CONSENT_VERSION }),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe('listMine / listMembers', () => {
  it('lists only my active households', async () => {
    const a = await makeUser(prisma, 'a');
    const b = await makeUser(prisma, 'b');
    await makeHousehold(prisma, [{ userId: a.id, role: 'OWNER' }]);
    expect(await service.listMine(a.id)).toHaveLength(1);
    expect(await service.listMine(b.id)).toHaveLength(0);
  });

  it('lists members to a member but not to an outsider', async () => {
    const a = await makeUser(prisma, 'a');
    const b = await makeUser(prisma, 'b');
    const outsider = await makeUser(prisma, 'outsider');
    const household = await makeHousehold(prisma, [
      { userId: a.id, role: 'OWNER' },
      { userId: b.id, role: 'SPENDER' },
    ]);
    const members = await service.listMembers(a.id, household.id);
    expect(members.map((m) => m.name).sort()).toEqual(['a', 'b']);
    await expect(service.listMembers(outsider.id, household.id)).rejects.toMatchObject({ status: 404 });
  });
});
