import type { Membership, PrismaClient, Role } from '@prisma/client';
import { HttpError } from '../errors.js';

// The one place that decides whether a user may act inside a household.
// Non-members get 404 (not 403) so household ids can't be probed for existence.
export async function requireMembership(
  prisma: PrismaClient,
  userId: string,
  householdId: string,
  roles?: Role[],
): Promise<Membership> {
  const membership = await prisma.membership.findFirst({
    where: { householdId, userId, leftAt: null },
  });
  if (!membership) {
    throw new HttpError(404, 'Household not found');
  }
  if (roles && !roles.includes(membership.role)) {
    throw new HttpError(403, 'Your role does not allow this');
  }
  return membership;
}
