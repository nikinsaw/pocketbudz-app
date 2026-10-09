import { randomBytes } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { HttpError } from '../errors.js';
import { requireMembership } from './access.js';

// Bump when the household-mode agreement text changes; clients must send the
// version they showed the user, and it is stored with the acceptance time.
export const CONSENT_VERSION = '2026-10-v1';
const INVITE_TTL_DAYS = 7;

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

    // Only the owner invites. Owner role can't be granted by invite.
    async createInvite(userId: string, householdId: string, role: 'EARNER' | 'SPENDER') {
      await requireMembership(prisma, userId, householdId, ['OWNER']);
      const invite = await prisma.invite.create({
        data: {
          householdId,
          role,
          code: randomBytes(6).toString('base64url'),
          expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
        },
      });
      return { code: invite.code, role: invite.role, expiresAt: invite.expiresAt };
    },

    async join(userId: string, input: { code: string; consentVersion: string }) {
      assertConsent(input.consentVersion);
      await assertNotInHousehold(userId);
      return prisma.$transaction(async (tx) => {
        const invite = await tx.invite.findUnique({ where: { code: input.code } });
        // Atomic claim: only one joiner can flip usedAt from null.
        const claimed = invite
          ? await tx.invite.updateMany({
              where: { id: invite.id, usedAt: null, expiresAt: { gt: new Date() } },
              data: { usedAt: new Date() },
            })
          : { count: 0 };
        if (!invite || claimed.count === 0) {
          throw new HttpError(400, 'Invalid or expired invite');
        }
        const membership = await tx.membership.create({
          data: { householdId: invite.householdId, userId, role: invite.role },
        });
        await tx.consentRecord.create({ data: { userId, version: input.consentVersion } });
        return { householdId: invite.householdId, role: membership.role };
      });
    },
  };
}

export type HouseholdService = ReturnType<typeof createHouseholdService>;
