import type { PrismaClient } from '@prisma/client';
import { HttpError } from '../errors.js';
import { requireMembership } from '../households/access.js';
import { isEarner } from '../visibility/resolve.js';

// An allowance is money an earner sets aside each budget cycle for a spender's
// personal budget. One allowance per (earner, spender) pair; setting it again
// replaces the amount.
export function createAllowanceService(prisma: PrismaClient) {
  return {
    async set(userId: string, householdId: string, spenderId: string, amount: number) {
      const me = await requireMembership(prisma, userId, householdId, ['OWNER', 'EARNER']);
      if (spenderId === me.id) {
        throw new HttpError(400, 'You cannot set an allowance for yourself');
      }
      const spender = await prisma.membership.findFirst({
        where: { id: spenderId, householdId, leftAt: null },
      });
      if (!spender) {
        throw new HttpError(404, 'Member not found');
      }
      if (isEarner(spender.role)) {
        throw new HttpError(400, 'Allowances are for spenders');
      }
      const allowance = await prisma.allowance.upsert({
        where: { fromId_toId: { fromId: me.id, toId: spender.id } },
        update: { amount },
        create: { householdId, fromId: me.id, toId: spender.id, amount },
      });
      return { toId: allowance.toId, amount: allowance.amount };
    },

    // Earners see every allowance; a spender sees only what is set aside for them.
    async list(userId: string, householdId: string) {
      const me = await requireMembership(prisma, userId, householdId);
      const rows = await prisma.allowance.findMany({
        where: isEarner(me.role) ? { householdId } : { householdId, toId: me.id },
        include: {
          from: { select: { user: { select: { name: true } } } },
          to: { select: { user: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'asc' },
      });
      return {
        total: rows.reduce((sum, row) => sum + row.amount, 0),
        allowances: rows.map((row) => ({
          fromId: row.fromId,
          from: row.from.user?.name ?? 'Former member',
          toId: row.toId,
          to: row.to.user?.name ?? 'Former member',
          amount: row.amount,
          mine: row.fromId === me.id,
        })),
      };
    },

    // Only the earner who set it can remove it.
    async remove(userId: string, householdId: string, spenderId: string) {
      const me = await requireMembership(prisma, userId, householdId, ['OWNER', 'EARNER']);
      const { count } = await prisma.allowance.deleteMany({
        where: { householdId, fromId: me.id, toId: spenderId },
      });
      if (count === 0) {
        throw new HttpError(404, 'Allowance not found');
      }
    },
  };
}

export type AllowanceService = ReturnType<typeof createAllowanceService>;
