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

    // The owner hands the household to another member and becomes an earner, so
    // there is always exactly one owner. The new owner can no longer receive allowances.
    async transferOwnership(userId: string, householdId: string, membershipId: string) {
      const owner = await requireMembership(prisma, userId, householdId, ['OWNER']);
      if (membershipId === owner.id) {
        throw new HttpError(400, 'You already own this household');
      }
      const target = await findActiveTarget(householdId, membershipId);
      await prisma.$transaction(async (tx) => {
        // Guarded so two concurrent transfers cannot both succeed.
        const demoted = await tx.membership.updateMany({
          where: { id: owner.id, role: 'OWNER', leftAt: null },
          data: { role: 'EARNER' },
        });
        if (demoted.count === 0) {
          throw new HttpError(409, 'Ownership has already changed');
        }
        await tx.membership.update({ where: { id: target.id }, data: { role: 'OWNER' } });
        await tx.allowance.deleteMany({ where: { toId: target.id } });
      });
      return { ownerId: target.id, formerOwnerRole: 'EARNER' as const };
    },
  };
}

export type MemberService = ReturnType<typeof createMemberService>;
