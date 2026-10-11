import type { Membership, PrismaClient } from '@prisma/client';
import { HttpError } from '../errors.js';
import { requireMembership } from '../households/access.js';

const EARNING_ROLES = ['OWNER', 'EARNER'] as const;

export interface IncomeFields {
  label: string;
  amount: number; // paise per budget cycle
}

// Income is earner-only: spenders can neither record nor see it.
export function createIncomeService(prisma: PrismaClient) {
  const earnerOnly = (userId: string, householdId: string) =>
    requireMembership(prisma, userId, householdId, [...EARNING_ROLES]);

  async function findOwn(householdId: string, incomeId: string, membership: Membership) {
    const income = await prisma.incomeSource.findFirst({ where: { id: incomeId, householdId } });
    if (!income) {
      throw new HttpError(404, 'Income not found');
    }
    if (income.memberId !== membership.id) {
      throw new HttpError(403, 'Only the earner who added this can change it');
    }
    return income;
  }

  return {
    async create(userId: string, householdId: string, input: IncomeFields) {
      const membership = await earnerOnly(userId, householdId);
      return prisma.incomeSource.create({
        data: { householdId, memberId: membership.id, label: input.label, amount: input.amount },
      });
    },

    // Every earner sees all household income, plus the total in paise.
    async list(userId: string, householdId: string) {
      const membership = await earnerOnly(userId, householdId);
      const rows = await prisma.incomeSource.findMany({
        where: { householdId },
        include: { member: { select: { user: { select: { name: true } } } } },
        orderBy: { createdAt: 'asc' },
      });
      return {
        total: rows.reduce((sum, row) => sum + row.amount, 0),
        sources: rows.map((row) => ({
          id: row.id,
          label: row.label,
          amount: row.amount,
          mine: row.memberId === membership.id,
          earner: row.member.user?.name ?? 'Former member',
        })),
      };
    },

    async update(userId: string, householdId: string, incomeId: string, changes: Partial<IncomeFields>) {
      const membership = await earnerOnly(userId, householdId);
      const income = await findOwn(householdId, incomeId, membership);
      return prisma.incomeSource.update({ where: { id: income.id }, data: changes });
    },

    async remove(userId: string, householdId: string, incomeId: string) {
      const membership = await earnerOnly(userId, householdId);
      const income = await findOwn(householdId, incomeId, membership);
      await prisma.incomeSource.delete({ where: { id: income.id } });
    },
  };
}

export type IncomeService = ReturnType<typeof createIncomeService>;
