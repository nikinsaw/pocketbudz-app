import type { PrismaClient } from '@prisma/client';
import { createAllowanceService } from '../allowances/service.js';
import { createEnvelopeService } from '../envelopes/service.js';
import { requireMembership } from '../households/access.js';
import { createIncomeService } from '../income/service.js';
import { createVisibilityService } from '../visibility/service.js';
import { isEarner } from '../visibility/resolve.js';
import { cycleWindow, parseISODate } from './cycle.js';

// One call that gives a household member everything the dashboard shows for the current
// budget cycle, already filtered by what *they* may see. Doing this on the server keeps
// the visibility rules in one place and spares the phone from downloading and adding up
// every transaction. All amounts are paise.
export function createDashboardService(prisma: PrismaClient) {
  const envelopes = createEnvelopeService(prisma);
  const visibility = createVisibilityService(prisma);
  const income = createIncomeService(prisma);
  const allowances = createAllowanceService(prisma);

  return {
    // `today` is the caller's local date (YYYY-MM-DD): the server's clock may be in
    // another time zone and would put "today" in the wrong cycle near midnight.
    async get(userId: string, householdId: string, today?: string) {
      const me = await requireMembership(prisma, userId, householdId);
      const todayISO = today ?? new Date().toISOString().slice(0, 10);
      parseISODate(todayISO);

      const household = await prisma.household.findUniqueOrThrow({ where: { id: householdId } });
      const period = cycleWindow(household.budgetCycleStartDay, todayISO);
      const range = { from: period.from, to: period.to };
      const earner = isEarner(me.role);

      const visibleEnvelopes = await envelopes.list(userId, householdId);
      const dateFilter = { gte: new Date(`${period.from}T00:00:00.000Z`), lte: new Date(`${period.to}T00:00:00.000Z`) };

      const [spentRows, ownerRows, members, incomeData, allowanceData] = await Promise.all([
        // Spending the caller can see inside each visible envelope: all of a shared
        // envelope, their own personal one, and another member's personal envelope only
        // for the transactions that member shared with them in full.
        prisma.transaction.groupBy({
          by: ['envelopeId'],
          where: {
            householdId,
            date: dateFilter,
            envelopeId: { in: visibleEnvelopes.map((e) => e.id) },
            OR: [
              { envelope: { scope: 'SHARED' } },
              { memberId: me.id },
              { visibility: { some: { viewerId: me.id, level: 'FULL' } } },
            ],
          },
          _sum: { amount: true },
        }),
        prisma.membership.findMany({
          where: { id: { in: visibleEnvelopes.flatMap((e) => (e.ownerId ? [e.ownerId] : [])) } },
          select: { id: true, user: { select: { name: true } } },
        }),
        visibility.spending(userId, householdId, range),
        earner ? income.list(userId, householdId) : Promise.resolve(null),
        allowances.list(userId, householdId),
      ]);

      const spentByEnvelope = new Map(spentRows.map((r) => [r.envelopeId, r._sum.amount ?? 0]));
      const ownerName = new Map(ownerRows.map((o) => [o.id, o.user?.name ?? 'Former member']));

      const envelopeViews = visibleEnvelopes.map((e) => ({
        id: e.id,
        title: e.title,
        icon: e.icon,
        colorKey: e.colorKey,
        categoryKey: e.categoryKey,
        type: e.type,
        scope: e.scope,
        budgetLimit: e.budgetLimit,
        spent: spentByEnvelope.get(e.id) ?? 0,
        mine: e.ownerId === me.id,
        owner: e.ownerId && e.ownerId !== me.id ? (ownerName.get(e.ownerId) ?? 'Former member') : null,
      }));

      const sharedSpent = members.reduce((sum, m) => sum + m.sharedSpent, 0);
      const privateSpent = members.reduce((sum, m) => sum + m.privateSpent, 0);
      const householdSpent = sharedSpent + privateSpent;
      const sharedEnvelopes = envelopeViews.filter((e) => e.scope === 'SHARED');

      return {
        period,
        household: {
          id: household.id,
          name: household.name,
          currencyFormat: household.currencyFormat,
        },
        me: { membershipId: me.id, role: me.role },
        // Earners see every member's total, so their household figure is complete; a
        // spender only sees shared spending plus what others chose to show them.
        headline: {
          householdSpent,
          sharedSpent,
          privateSpent,
          complete: earner,
          sharedBudget: sharedEnvelopes.reduce((sum, e) => sum + e.budgetLimit, 0),
          sharedBudgetSpent: sharedEnvelopes.reduce((sum, e) => sum + e.spent, 0),
          mySpent: (members.find((m) => m.isMe)?.sharedSpent ?? 0) + (members.find((m) => m.isMe)?.privateSpent ?? 0),
        },
        // Earners only: spenders get null and cannot infer income from anything else here.
        income: incomeData
          ? { total: incomeData.total, sources: incomeData.sources, leftOver: incomeData.total - householdSpent }
          : null,
        allowances: earner
          ? {
              given: allowanceData.allowances.filter((a) => a.mine).reduce((sum, a) => sum + a.amount, 0),
              total: allowanceData.total,
            }
          : { received: allowanceData.total },
        envelopes: envelopeViews,
        members,
      };
    },
  };
}

export type DashboardService = ReturnType<typeof createDashboardService>;
