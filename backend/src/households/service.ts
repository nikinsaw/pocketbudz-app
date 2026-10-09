import type { PrismaClient } from '@prisma/client';
import { HttpError } from '../errors.js';
import { requireMembership } from './access.js';

// Bump when the household-mode agreement text changes; clients must send the
// version they showed the user, and it is stored with the acceptance time.
export const CONSENT_VERSION = '2026-10-v1';

export function createHouseholdService(prisma: PrismaClient) {
  function assertConsent(consentVersion: string) {
    if (consentVersion !== CONSENT_VERSION) {
      throw new HttpError(400, 'You must accept the current household agreement');
    }
  }

  // v1 rule: one active household per user.
  async function assertNotInHousehold(userId: string) {
    const existing = await prisma.membership.findFirst({ where: { userId, leftAt: null } });
    if (existing) {
      throw new HttpError(409, 'You are already in a household');
    }
  }

  return {
    async create(userId: string, input: { name: string; consentVersion: string }) {
      assertConsent(input.consentVersion);
      await assertNotInHousehold(userId);
      return prisma.$transaction(async (tx) => {
        const household = await tx.household.create({
          data: { name: input.name, members: { create: { userId, role: 'OWNER' } } },
        });
        await tx.consentRecord.create({ data: { userId, version: input.consentVersion } });
        return household;
      });
    },

    async listMine(userId: string) {
      const memberships = await prisma.membership.findMany({
        where: { userId, leftAt: null },
        include: { household: true },
      });
      return memberships.map((m) => ({
        id: m.household.id,
        name: m.household.name,
        role: m.role,
        membershipId: m.id,
      }));
    },

    async listMembers(userId: string, householdId: string) {
      await requireMembership(prisma, userId, householdId);
      const members = await prisma.membership.findMany({
        where: { householdId, leftAt: null },
        include: { user: { select: { name: true } } },
        orderBy: { joinedAt: 'asc' },
      });
      return members.map((m) => ({
        membershipId: m.id,
        role: m.role,
        name: m.user?.name ?? 'Former member',
        joinedAt: m.joinedAt,
      }));
    },
  };
}

export type HouseholdService = ReturnType<typeof createHouseholdService>;
