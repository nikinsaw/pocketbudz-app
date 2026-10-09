import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../db.js';
import { HttpError } from '../errors.js';
import { requireMembership } from './access.js';
import { makeHousehold, makeUser, resetDb } from './testUtils.js';

beforeEach(() => resetDb(prisma));
afterAll(() => prisma.$disconnect());

async function setup() {
  const owner = await makeUser(prisma, 'owner');
  const spender = await makeUser(prisma, 'spender');
  const outsider = await makeUser(prisma, 'outsider');
  const household = await makeHousehold(prisma, [
    { userId: owner.id, role: 'OWNER' },
    { userId: spender.id, role: 'SPENDER' },
  ]);
  return { owner, spender, outsider, household };
}

describe('requireMembership', () => {
  it('returns the membership for a member', async () => {
    const { owner, household } = await setup();
    const m = await requireMembership(prisma, owner.id, household.id);
    expect(m.role).toBe('OWNER');
  });

  it('hides the household from non-members with 404', async () => {
    const { outsider, household } = await setup();
    await expect(requireMembership(prisma, outsider.id, household.id)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('rejects a member whose role is not allowed with 403', async () => {
    const { spender, household } = await setup();
    const err = await requireMembership(prisma, spender.id, household.id, ['OWNER']).catch((e) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(403);
  });

  it('treats someone who left as a non-member', async () => {
    const { spender, household } = await setup();
    await prisma.membership.updateMany({
      where: { userId: spender.id },
      data: { leftAt: new Date() },
    });
    await expect(requireMembership(prisma, spender.id, household.id)).rejects.toMatchObject({
      status: 404,
    });
  });
});
