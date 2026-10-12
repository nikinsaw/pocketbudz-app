import type { Membership, PrismaClient } from '@prisma/client';

// Takes a member out of their household (they left or were removed).
//
// Kept, anonymised: their transactions, so household totals stay correct. The
// membership row stays too, with the account detached.
// Removed: everything forward-looking or personal - allowances, income sources,
// personal envelopes and all sharing settings. Itemised detail of their private
// spending is downgraded to totals-only, so earners keep the totals but can no
// longer read merchants of someone who is gone.
export async function detachMember(prisma: PrismaClient, membership: Membership) {
  await prisma.$transaction([
    prisma.allowance.deleteMany({
      where: { OR: [{ fromId: membership.id }, { toId: membership.id }] },
    }),
    prisma.incomeSource.deleteMany({ where: { memberId: membership.id } }),
    prisma.envelope.deleteMany({ where: { ownerId: membership.id, scope: 'PERSONAL' } }),
    prisma.visibilityGrant.deleteMany({
      where: { OR: [{ ownerId: membership.id }, { viewerId: membership.id }] },
    }),
    prisma.transactionVisibility.updateMany({
      where: { level: 'FULL', transaction: { memberId: membership.id } },
      data: { level: 'TOTAL' },
    }),
    prisma.transactionVisibility.deleteMany({ where: { viewerId: membership.id } }),
    prisma.membership.update({
      where: { id: membership.id },
      data: { leftAt: new Date(), userId: null },
    }),
  ]);
}
