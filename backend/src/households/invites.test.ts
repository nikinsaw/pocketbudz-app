import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../db.js';
import { CONSENT_VERSION, createHouseholdService } from './service.js';
import { makeHousehold, makeUser, resetDb } from './testUtils.js';

const service = createHouseholdService(prisma);

beforeEach(() => resetDb(prisma));
afterAll(() => prisma.$disconnect());

async function setup() {
  const owner = await makeUser(prisma, 'owner');
  const joiner = await makeUser(prisma, 'joiner');
  const household = await makeHousehold(prisma, [{ userId: owner.id, role: 'OWNER' }]);
  return { owner, joiner, household };
}

describe('createInvite', () => {
  it('lets the owner create an invite', async () => {
    const { owner, household } = await setup();
    const invite = await service.createInvite(owner.id, household.id, 'SPENDER');
    expect(invite.code.length).toBeGreaterThanOrEqual(8);
    expect(invite.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('forbids non-owners', async () => {
    const { owner, joiner, household } = await setup();
    const { code } = await service.createInvite(owner.id, household.id, 'EARNER');
    await service.join(joiner.id, { code, consentVersion: CONSENT_VERSION });
    await expect(service.createInvite(joiner.id, household.id, 'SPENDER')).rejects.toMatchObject({
      status: 403,
    });
  });
});

describe('join', () => {
  it('adds the member with the invited role and records consent', async () => {
    const { owner, joiner, household } = await setup();
    const { code } = await service.createInvite(owner.id, household.id, 'SPENDER');
    const result = await service.join(joiner.id, { code, consentVersion: CONSENT_VERSION });
    expect(result).toMatchObject({ householdId: household.id, role: 'SPENDER' });
    expect(await prisma.consentRecord.count({ where: { userId: joiner.id } })).toBe(1);
  });

  it('rejects an invite that was already used', async () => {
    const { owner, joiner, household } = await setup();
    const other = await makeUser(prisma, 'other');
    const { code } = await service.createInvite(owner.id, household.id, 'SPENDER');
    await service.join(joiner.id, { code, consentVersion: CONSENT_VERSION });
    await expect(
      service.join(other.id, { code, consentVersion: CONSENT_VERSION }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('only one of two simultaneous joiners wins', async () => {
    const { owner, joiner, household } = await setup();
    const other = await makeUser(prisma, 'other');
    const { code } = await service.createInvite(owner.id, household.id, 'SPENDER');
    const results = await Promise.allSettled([
      service.join(joiner.id, { code, consentVersion: CONSENT_VERSION }),
      service.join(other.id, { code, consentVersion: CONSENT_VERSION }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });

  it('rejects an expired invite', async () => {
    const { owner, joiner, household } = await setup();
    const { code } = await service.createInvite(owner.id, household.id, 'SPENDER');
    await prisma.invite.update({ where: { code }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(
      service.join(joiner.id, { code, consentVersion: CONSENT_VERSION }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects an unknown code and a missing consent', async () => {
    const { owner, joiner, household } = await setup();
    await expect(
      service.join(joiner.id, { code: 'nope', consentVersion: CONSENT_VERSION }),
    ).rejects.toMatchObject({ status: 400 });
    const { code } = await service.createInvite(owner.id, household.id, 'SPENDER');
    await expect(service.join(joiner.id, { code, consentVersion: 'old' })).rejects.toMatchObject({
      status: 400,
    });
    expect(await prisma.membership.count({ where: { userId: joiner.id } })).toBe(0);
  });

  it('refuses someone already in a household', async () => {
    const { owner, household } = await setup();
    const { code } = await service.createInvite(owner.id, household.id, 'SPENDER');
    await expect(
      service.join(owner.id, { code, consentVersion: CONSENT_VERSION }),
    ).rejects.toMatchObject({ status: 409 });
  });
});
