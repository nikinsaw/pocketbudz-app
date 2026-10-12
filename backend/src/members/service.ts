import type { Membership, PrismaClient } from '@prisma/client';
import { HttpError } from '../errors.js';
import { requireMembership } from '../households/access.js';

// Owner-only household administration: roles, ownership and removing members.
export function createMemberService(prisma: PrismaClient) {
  async function findActiveTarget(householdId: string, membershipId: string): Promise<Membership> {
    const target = await prisma.membership.findFirst({
      where: { id: membershipId, householdId, leftAt: null },
    });
    if (!target) {
      throw new HttpError(404, 'Member not found');
    }
    return target;
  }

  return {
    // Earner <-> spender only. Ownership moves through transferOwnership().
    async changeRole(
      userId: string,
      householdId: string,
      membershipId: string,
      role: 'EARNER' | 'SPENDER',
    ) {
      await requireMembership(prisma, userId, householdId, ['OWNER']);
      const target = await findActiveTarget(householdId, membershipId);
      if (target.role === 'OWNER') {
        throw new HttpError(409, 'Transfer ownership instead of changing the owner role');
      }
      if (target.role === role) {
        return { membershipId, role };
      }
      await prisma.$transaction(async (tx) => {
        await tx.membership.update({ where: { id: target.id }, data: { role } });
        if (role === 'SPENDER') {
          // Demoted: earner-only data goes with the role. Totals they could see only
          // because they were an earner (TOTAL stamps) are withdrawn; FULL shares were
          // an explicit choice by the spender and stay.
          await tx.incomeSource.deleteMany({ where: { memberId: target.id } });
          await tx.allowance.deleteMany({ where: { fromId: target.id } });
          await tx.transactionVisibility.deleteMany({
            where: { viewerId: target.id, level: 'TOTAL' },
          });
        } else {
          // Promoted: earners cannot receive allowances.
          await tx.allowance.deleteMany({ where: { toId: target.id } });
        }
      });
      return { membershipId, role };
    },
  };
}

export type MemberService = ReturnType<typeof createMemberService>;
