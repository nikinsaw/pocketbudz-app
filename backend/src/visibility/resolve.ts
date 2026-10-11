import type { Prisma, Role, VisibilityLevel } from '@prisma/client';

export type Db = Prisma.TransactionClient;

const RANK: Record<VisibilityLevel, number> = { NONE: 0, TOTAL: 1, FULL: 2 };

export const isEarner = (role: Role) => role === 'OWNER' || role === 'EARNER';
export const atLeast = (level: VisibilityLevel, min: VisibilityLevel) => RANK[level] >= RANK[min];

interface Grant {
  viewerId: string | null; // null = everyone
  level: VisibilityLevel;
}

// What `viewer` may see of one owner's personal spending, given that owner's grants.
// Precedence: grant for this viewer > grant for everyone > default.
// Defaults: earners see totals, other spenders see nothing. Earners can never be
// dropped below TOTAL - household income holders always see where totals go.
export function effectiveLevel(
  grants: Grant[],
  viewer: { id: string; role: Role },
): VisibilityLevel {
  const specific = grants.find((g) => g.viewerId === viewer.id);
  const everyone = grants.find((g) => g.viewerId === null);
  const chosen = specific?.level ?? everyone?.level ?? (isEarner(viewer.role) ? 'TOTAL' : 'NONE');
  return isEarner(viewer.role) && !atLeast(chosen, 'TOTAL') ? 'TOTAL' : chosen;
}

// The level each other active member currently gets for `owner`'s spending.
export async function levelsForOwner(db: Db, owner: { id: string; householdId: string }) {
  const [grants, viewers] = await Promise.all([
    db.visibilityGrant.findMany({ where: { ownerId: owner.id } }),
    db.membership.findMany({
      where: { householdId: owner.householdId, leftAt: null, id: { not: owner.id } },
      select: { id: true, role: true },
    }),
  ]);
  return viewers.map((viewer) => ({ viewerId: viewer.id, level: effectiveLevel(grants, viewer) }));
}

// Owners whose spending `viewer` currently sees at `min` or better.
export async function ownersVisibleAt(
  db: Db,
  householdId: string,
  viewer: { id: string; role: Role },
  min: VisibilityLevel,
): Promise<Set<string>> {
  const owners = await db.membership.findMany({
    where: { householdId, leftAt: null, id: { not: viewer.id } },
    select: { id: true, grantsGiven: true },
  });
  return new Set(
    owners
      .filter((owner) => atLeast(effectiveLevel(owner.grantsGiven, viewer), min))
      .map((owner) => owner.id),
  );
}
