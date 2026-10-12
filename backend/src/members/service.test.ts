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
