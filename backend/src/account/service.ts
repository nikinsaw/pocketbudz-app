import type { PrismaClient } from '@prisma/client';
import { HttpError } from '../errors.js';
import { requireMembership } from '../households/access.js';

const rupees = (paise: number) => paise / 100;

// Everything the caller can legitimately take with them from one household, in
// rupees and in the same shape the solo-import endpoint accepts, so it doubles as
// "go back to solo mode". Only the caller's own data plus what is shared with the
// whole household: never anyone else's private spending.
export function createAccountService(prisma: PrismaClient) {
  async function exportHousehold(userId: string, householdId: string) {
    const me = await requireMembership(prisma, userId, householdId);
    const [household, envelopes, transactions, income, allowances, sharing] = await Promise.all([
      prisma.household.findUniqueOrThrow({ where: { id: householdId } }),
      prisma.envelope.findMany({
        where: { householdId, OR: [{ scope: 'SHARED' }, { ownerId: me.id }] },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.transaction.findMany({
        where: { householdId, memberId: me.id },
        include: { envelope: { select: { title: true } } },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      }),
      prisma.incomeSource.findMany({ where: { memberId: me.id }, orderBy: { createdAt: 'asc' } }),
      prisma.allowance.findMany({
        where: { OR: [{ fromId: me.id }, { toId: me.id }] },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.visibilityGrant.findMany({ where: { ownerId: me.id } }),
    ]);
    return {
      household: {
        id: household.id,
        name: household.name,
        currencyFormat: household.currencyFormat,
        budgetCycleStartDay: household.budgetCycleStartDay,
      },
      role: me.role,
      monthlyIncome: income.length ? rupees(income.reduce((sum, i) => sum + i.amount, 0)) : null,
      incomeSources: income.map((i) => ({ label: i.label, amount: rupees(i.amount) })),
      envelopes: envelopes.map((e) => ({
        categoryKey: e.categoryKey,
        icon: e.icon,
        title: e.title,
        colorKey: e.colorKey,
        type: e.type,
        budgetLimit: rupees(e.budgetLimit),
        scope: e.scope,
      })),
      transactions: transactions.map((t) => ({
        merchant: t.merchant,
        category: t.category,
        amount: rupees(t.amount),
        date: t.date.toISOString().slice(0, 10),
        envelope: t.envelope?.title ?? null,
      })),
      allowances: allowances.map((a) => ({
        direction: a.fromId === me.id ? 'given' : 'received',
        amount: rupees(a.amount),
      })),
      sharingSettings: sharing.map((g) => ({
        with: g.viewerId ?? 'everyone',
        level: g.level,
      })),
    };
  }

  return {
    exportHousehold,

    // The caller's whole account: profile, agreements accepted, and their data
    // from every household they are currently in.
    async exportAccount(userId: string) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          consents: { orderBy: { acceptedAt: 'asc' } },
          memberships: { where: { leftAt: null }, select: { householdId: true } },
        },
      });
      if (!user || user.deletedAt) {
        throw new HttpError(404, 'Account not found');
      }
      return {
        exportedAt: new Date().toISOString(),
        account: { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt },
        agreements: user.consents.map((c) => ({ version: c.version, acceptedAt: c.acceptedAt })),
        households: await Promise.all(user.memberships.map((m) => exportHousehold(userId, m.householdId))),
      };
    },
  };
}

export type AccountService = ReturnType<typeof createAccountService>;
