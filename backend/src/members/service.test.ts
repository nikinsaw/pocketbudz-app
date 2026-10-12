import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createAllowanceService } from '../allowances/service.js';
import { prisma } from '../db.js';
import { makeHousehold, makeUser, resetDb } from '../households/testUtils.js';
import { createIncomeService } from '../income/service.js';
import { createTransactionService } from '../transactions/service.js';
import { createMemberService } from './service.js';

const service = createMemberService(prisma);
const income = createIncomeService(prisma);
const allowances = createAllowanceService(prisma);
const transactions = createTransactionService(prisma);

beforeEach(() => resetDb(prisma));
afterAll(() => prisma.$disconnect());

async function setup() {
  const owner = await makeUser(prisma, 'owner');
  const earner = await makeUser(prisma, 'earner');
  const spender = await makeUser(prisma, 'spender');
  const household = await makeHousehold(prisma, [
    { userId: owner.id, role: 'OWNER' },
    { userId: earner.id, role: 'EARNER' },
    { userId: spender.id, role: 'SPENDER' },
  ]);
  const m = (userId: string) => household.members.find((x) => x.userId === userId)!;
  return { owner, earner, spender, household, mOwner: m(owner.id), mEarner: m(earner.id), mSpender: m(spender.id) };
}

describe('remove', () => {
  it('lets the owner remove a member, who loses access and personal data', async () => {
    const { owner, spender, household, mSpender } = await setup();
    await allowances.set(owner.id, household.id, mSpender.id, 100000);
    await service.remove(owner.id, household.id, mSpender.id);

    const gone = await prisma.membership.findUniqueOrThrow({ where: { id: mSpender.id } });
    expect(gone.userId).toBeNull();
    expect(gone.leftAt).not.toBeNull();
    expect(await prisma.allowance.count()).toBe(0);
    await expect(transactions.list(spender.id, household.id)).rejects.toMatchObject({ status: 404 });
  });

  it('is owner-only and cannot target the owner, strangers or people who already left', async () => {
    const { owner, earner, household, mOwner, mEarner, mSpender } = await setup();
    await expect(service.remove(earner.id, household.id, mSpender.id)).rejects.toMatchObject({ status: 403 });
    await expect(service.remove(owner.id, household.id, mOwner.id)).rejects.toMatchObject({ status: 400 });
    await expect(service.remove(owner.id, household.id, 'nope')).rejects.toMatchObject({ status: 404 });
    await service.remove(owner.id, household.id, mEarner.id);
    await expect(service.remove(owner.id, household.id, mEarner.id)).rejects.toMatchObject({ status: 404 });
  });

  it('a removed member can join again with a new invite', async () => {
    const { owner, spender, household, mSpender } = await setup();
    await service.remove(owner.id, household.id, mSpender.id);
    const { createHouseholdService, CONSENT_VERSION } = await import('../households/service.js');
    const houses = createHouseholdService(prisma);
    const { code } = await houses.createInvite(owner.id, household.id, 'SPENDER');
    await expect(houses.join(spender.id, { code, consentVersion: CONSENT_VERSION })).resolves.toMatchObject({ role: 'SPENDER' });
  });
});

describe('transferOwnership', () => {
  it('moves ownership, demotes the old owner to earner and keeps exactly one owner', async () => {
    const { owner, spender, household, mOwner, mSpender } = await setup();
    await allowances.set(owner.id, household.id, mSpender.id, 100000);
    const result = await service.transferOwnership(owner.id, household.id, mSpender.id);
    expect(result).toEqual({ ownerId: mSpender.id, formerOwnerRole: 'EARNER' });

    const roles = Object.fromEntries((await prisma.membership.findMany()).map((m) => [m.id, m.role]));
    expect(roles[mSpender.id]).toBe('OWNER');
    expect(roles[mOwner.id]).toBe('EARNER');
    expect(Object.values(roles).filter((r) => r === 'OWNER')).toHaveLength(1);
    expect(await prisma.allowance.count()).toBe(0);
    await expect(service.changeRole(owner.id, household.id, mSpender.id, 'EARNER')).rejects.toMatchObject({ status: 403 });
    await expect(service.changeRole(spender.id, household.id, mOwner.id, 'SPENDER')).resolves.toBeTruthy();
  });

  it('lets the former owner leave afterwards', async () => {
    const { owner, household, mEarner } = await setup();
    await service.transferOwnership(owner.id, household.id, mEarner.id);
    const { createHouseholdService } = await import('../households/service.js');
    await expect(createHouseholdService(prisma).leave(owner.id, household.id)).resolves.toEqual({ householdDeleted: false });
  });

  it('is owner-only and rejects self, unknown and departed targets', async () => {
    const { owner, earner, spender, household, mOwner, mSpender } = await setup();
    await expect(service.transferOwnership(earner.id, household.id, mSpender.id)).rejects.toMatchObject({ status: 403 });
    await expect(service.transferOwnership(owner.id, household.id, mOwner.id)).rejects.toMatchObject({ status: 400 });
    await expect(service.transferOwnership(owner.id, household.id, 'nope')).rejects.toMatchObject({ status: 404 });
    await prisma.membership.update({ where: { id: mSpender.id }, data: { leftAt: new Date(), userId: null } });
    await expect(service.transferOwnership(owner.id, household.id, mSpender.id)).rejects.toMatchObject({ status: 404 });
    expect(spender).toBeTruthy();
  });

  it('only one of two concurrent transfers wins', async () => {
    const { owner, household, mEarner, mSpender } = await setup();
    const results = await Promise.allSettled([
      service.transferOwnership(owner.id, household.id, mEarner.id),
      service.transferOwnership(owner.id, household.id, mSpender.id),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await prisma.membership.count({ where: { role: 'OWNER' } })).toBe(1);
  });
});

describe('changeRole', () => {
  it('only the owner can change roles', async () => {
    const { earner, spender, household, mSpender, mEarner } = await setup();
    await expect(service.changeRole(earner.id, household.id, mSpender.id, 'EARNER')).rejects.toMatchObject({ status: 403 });
    await expect(service.changeRole(spender.id, household.id, mEarner.id, 'SPENDER')).rejects.toMatchObject({ status: 403 });
  });

  it('promotes a spender to earner and drops allowances paid to them', async () => {
    const { owner, spender, household, mSpender } = await setup();
    await allowances.set(owner.id, household.id, mSpender.id, 100000);
    expect(await service.changeRole(owner.id, household.id, mSpender.id, 'EARNER')).toEqual({ membershipId: mSpender.id, role: 'EARNER' });
    expect(await prisma.allowance.count()).toBe(0);
    await expect(income.create(spender.id, household.id, { label: 'Job', amount: 100 })).resolves.toBeTruthy();
  });

  it('demotes an earner: income, given allowances and earner-only totals go; FULL shares stay', async () => {
    const { owner, earner, spender, household, mEarner, mSpender } = await setup();
    await income.create(earner.id, household.id, { label: 'Salary', amount: 5000000 });
    await allowances.set(earner.id, household.id, mSpender.id, 100000);
    await prisma.visibilityGrant.create({ data: { ownerId: mSpender.id, viewerId: mEarner.id, level: 'FULL' } });
    const tx = (merchant: string) => ({ envelopeId: null, merchant, category: 'Fun', amount: 1000, date: '2026-10-05' });
    await transactions.create(spender.id, household.id, tx('Full')); // earner stamped FULL
    await prisma.visibilityGrant.update({ where: { ownerId_viewerId: { ownerId: mSpender.id, viewerId: mEarner.id } }, data: { level: 'TOTAL' } });
    await transactions.create(spender.id, household.id, tx('Total')); // earner stamped TOTAL

    await service.changeRole(owner.id, household.id, mEarner.id, 'SPENDER');

    expect(await prisma.incomeSource.count()).toBe(0);
    expect(await prisma.allowance.count()).toBe(0);
    const stamps = await prisma.transactionVisibility.findMany({ where: { viewerId: mEarner.id } });
    expect(stamps.map((s) => s.level)).toEqual(['FULL']);
    await expect(income.list(earner.id, household.id)).rejects.toMatchObject({ status: 403 });
  });

  it('is a no-op when the role is unchanged', async () => {
    const { owner, household, mSpender } = await setup();
    await expect(service.changeRole(owner.id, household.id, mSpender.id, 'SPENDER')).resolves.toMatchObject({ role: 'SPENDER' });
  });

  it('refuses to touch the owner role, and 404s for unknown or other-household members', async () => {
    const { owner, household, mOwner } = await setup();
    await expect(service.changeRole(owner.id, household.id, mOwner.id, 'SPENDER')).rejects.toMatchObject({ status: 409 });
    await expect(service.changeRole(owner.id, household.id, 'nope', 'SPENDER')).rejects.toMatchObject({ status: 404 });
    const other = await makeUser(prisma, 'other');
    const otherHome = await makeHousehold(prisma, [{ userId: other.id, role: 'OWNER' }, { userId: (await makeUser(prisma, 'y')).id, role: 'SPENDER' }]);
    await expect(service.changeRole(owner.id, household.id, otherHome.members[1].id, 'EARNER')).rejects.toMatchObject({ status: 404 });
  });
});
