import type { PrismaClient, VisibilityLevel } from '@prisma/client';
import { HttpError } from '../errors.js';
import { requireMembership } from '../households/access.js';
import { parseDate } from '../transactions/service.js';
import { effectiveLevel, isEarner } from './resolve.js';

export const EVERYONE = 'everyone';

// Sharing settings for the caller's own personal spending. Changing a setting
// only affects transactions created afterwards (levels are stamped on creation).
export function createVisibilityService(prisma: PrismaClient) {
  async function resolveViewer(householdId: string, ownerId: string, viewer: string) {
    if (viewer === EVERYONE) return null;
    if (viewer === ownerId) {
      throw new HttpError(400, 'You always see your own spending');
    }
    const member = await prisma.membership.findFirst({
      where: { id: viewer, householdId, leftAt: null },
    });
    if (!member) {
      throw new HttpError(404, 'Member not found');
    }
    return member;
  }

  return {
    async set(userId: string, householdId: string, viewer: string, level: VisibilityLevel) {
      const me = await requireMembership(prisma, userId, householdId);
      const target = await resolveViewer(householdId, me.id, viewer);
      if (target && isEarner(target.role) && level === 'NONE') {
        throw new HttpError(400, 'Earners always see your total spending');
      }
      const viewerId = target?.id ?? null;
      const existing = await prisma.visibilityGrant.findFirst({ where: { ownerId: me.id, viewerId } });
      if (existing) {
        await prisma.visibilityGrant.update({ where: { id: existing.id }, data: { level } });
      } else {
        await prisma.visibilityGrant.create({ data: { ownerId: me.id, viewerId, level } });
      }
      return { viewer: viewerId ?? EVERYONE, level };
    },

    // Back to the default for that viewer.
    async reset(userId: string, householdId: string, viewer: string) {
      const me = await requireMembership(prisma, userId, householdId);
      const target = await resolveViewer(householdId, me.id, viewer);
      await prisma.visibilityGrant.deleteMany({ where: { ownerId: me.id, viewerId: target?.id ?? null } });
    },

    // Per-member spending as far as the caller may see it (all amounts in paise):
    //  - sharedSpent:   spending in shared envelopes (visible to the whole household)
    //  - privateSpent:  private spending the caller can see at least as a total
    //  - itemisedSpent: the part of privateSpent the caller can also itemise
    //  - currentLevel:  what the member's settings give the caller for *new* spending
    // Spenders who share nothing contribute only sharedSpent; earners always get totals.
    async spending(userId: string, householdId: string, range: { from?: string; to?: string } = {}) {
      const me = await requireMembership(prisma, userId, householdId);
      const date = {
        ...(range.from ? { gte: parseDate(range.from) } : {}),
        ...(range.to ? { lte: parseDate(range.to) } : {}),
      };
      const [members, sharedRows, myPrivate, stamped] = await Promise.all([
        prisma.membership.findMany({
          where: { householdId },
          include: { user: { select: { name: true } }, grantsGiven: true },
          orderBy: { joinedAt: 'asc' },
        }),
        prisma.transaction.groupBy({
          by: ['memberId'],
          where: { householdId, date, envelope: { scope: 'SHARED' } },
          _sum: { amount: true },
        }),
        prisma.transaction.aggregate({
          where: {
            householdId, date, memberId: me.id,
            OR: [{ envelopeId: null }, { envelope: { scope: 'PERSONAL' } }],
          },
          _sum: { amount: true },
        }),
        prisma.transaction.findMany({
          where: { householdId, date, visibility: { some: { viewerId: me.id, level: { in: ['TOTAL', 'FULL'] } } } },
          select: { memberId: true, amount: true, visibility: { where: { viewerId: me.id }, select: { level: true } } },
        }),
      ]);

      const shared = new Map(sharedRows.map((row) => [row.memberId, row._sum.amount ?? 0]));
      const privateSeen = new Map<string, number>();
      const itemised = new Map<string, number>();
      for (const row of stamped) {
        if (!row.memberId) continue;
        privateSeen.set(row.memberId, (privateSeen.get(row.memberId) ?? 0) + row.amount);
        if (row.visibility[0]?.level === 'FULL') {
          itemised.set(row.memberId, (itemised.get(row.memberId) ?? 0) + row.amount);
        }
      }
      const mine = myPrivate._sum.amount ?? 0;

      return members
        // Hide departed members who have nothing visible in this period.
        .filter((m) => m.leftAt === null || (shared.get(m.id) ?? 0) > 0 || (privateSeen.get(m.id) ?? 0) > 0)
        .map((m) => {
          const isMe = m.id === me.id;
          return {
            membershipId: m.id,
            name: m.user?.name ?? 'Former member',
            role: m.role,
            isMe,
            sharedSpent: shared.get(m.id) ?? 0,
            privateSpent: isMe ? mine : (privateSeen.get(m.id) ?? 0),
            itemisedSpent: isMe ? mine : (itemised.get(m.id) ?? 0),
            currentLevel: isMe ? 'FULL' : effectiveLevel(m.grantsGiven, me),
          };
        });
    },

    // What I currently share, and what each other member effectively sees.
    async overview(userId: string, householdId: string) {
      const me = await requireMembership(prisma, userId, householdId);
      const [grants, others] = await Promise.all([
        prisma.visibilityGrant.findMany({ where: { ownerId: me.id } }),
        prisma.membership.findMany({
          where: { householdId, leftAt: null, id: { not: me.id } },
          include: { user: { select: { name: true } } },
          orderBy: { joinedAt: 'asc' },
        }),
      ]);
      return {
        everyone: grants.find((g) => g.viewerId === null)?.level ?? null,
        members: others.map((m) => ({
          membershipId: m.id,
          name: m.user?.name ?? 'Former member',
          role: m.role,
          explicit: grants.find((g) => g.viewerId === m.id)?.level ?? null,
          effective: effectiveLevel(grants, m),
        })),
      };
    },
  };
}

export type VisibilityService = ReturnType<typeof createVisibilityService>;
