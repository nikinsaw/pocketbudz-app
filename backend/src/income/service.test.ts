import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../db.js';
import { makeHousehold, makeUser, resetDb } from '../households/testUtils.js';
import { createIncomeService } from './service.js';

const service = createIncomeService(prisma);

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
  return { owner, earner, spender, household };
}

describe('income', () => {
  it('lets several earners record income and totals it for each of them', async () => {
    const { owner, earner, household } = await setup();
    await service.create(owner.id, household.id, { label: 'Salary', amount: 8000000 });
    await service.create(earner.id, household.id, { label: 'Freelance', amount: 2500000 });

    const seenByEarner = await service.list(earner.id, household.id);
    expect(seenByEarner.total).toBe(10500000);
    expect(seenByEarner.sources.map((s) => [s.label, s.earner, s.mine])).toEqual([
      ['Salary', 'owner', false],
      ['Freelance', 'earner', true],
    ]);
  });

  it('keeps income away from spenders entirely', async () => {
    const { owner, spender, household } = await setup();
    await service.create(owner.id, household.id, { label: 'Salary', amount: 8000000 });
    await expect(service.list(spender.id, household.id)).rejects.toMatchObject({ status: 403 });
    await expect(
      service.create(spender.id, household.id, { label: 'Hmm', amount: 1 }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('only lets the earner who added a source change or delete it', async () => {
    const { owner, earner, household } = await setup();
    const salary = await service.create(owner.id, household.id, { label: 'Salary', amount: 8000000 });
    await expect(
      service.update(earner.id, household.id, salary.id, { amount: 1 }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(service.remove(earner.id, household.id, salary.id)).rejects.toMatchObject({ status: 403 });

    const updated = await service.update(owner.id, household.id, salary.id, { amount: 8500000 });
    expect(updated.amount).toBe(8500000);
    await service.remove(owner.id, household.id, salary.id);
    expect((await service.list(owner.id, household.id)).total).toBe(0);
  });

  it("can't reach a source through another household", async () => {
    const { owner, household } = await setup();
    const other = await makeUser(prisma, 'other');
    const otherHome = await makeHousehold(prisma, [{ userId: other.id, role: 'OWNER' }]);
    const salary = await service.create(owner.id, household.id, { label: 'Salary', amount: 100 });
    await expect(
      service.update(other.id, otherHome.id, salary.id, { amount: 1 }),
    ).rejects.toMatchObject({ status: 404 });
  });
});
