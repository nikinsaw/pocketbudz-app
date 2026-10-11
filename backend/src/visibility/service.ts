import type { PrismaClient, VisibilityLevel } from '@prisma/client';
import { HttpError } from '../errors.js';
import { requireMembership } from '../households/access.js';
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
