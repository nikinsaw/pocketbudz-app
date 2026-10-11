import type { Envelope, EnvelopeScope, Membership, PrismaClient } from '@prisma/client';
import { HttpError } from '../errors.js';
import { requireMembership } from '../households/access.js';

export interface EnvelopeFields {
  categoryKey: string;
  icon: string;
  title: string;
  colorKey: string;
  type: string;
  budgetLimit: number; // paise
}

const SHARED_MANAGERS = ['OWNER', 'EARNER'] as const;

export function createEnvelopeService(prisma: PrismaClient) {
  // Shared envelopes are visible to everyone; a personal envelope only to its
  // owner (sharing with other members is added by the visibility module).
  function canSee(envelope: Envelope, membership: Membership) {
    return envelope.scope === 'SHARED' || envelope.ownerId === membership.id;
  }

  // Shared: owner/earner. Personal: only the member it belongs to.
  function assertCanManage(envelope: Envelope, membership: Membership) {
    const allowed =
      envelope.scope === 'SHARED'
        ? (SHARED_MANAGERS as readonly string[]).includes(membership.role)
        : envelope.ownerId === membership.id;
    if (!allowed) {
      throw new HttpError(403, 'Your role does not allow this');
    }
  }

  async function findVisible(householdId: string, envelopeId: string, membership: Membership) {
    const envelope = await prisma.envelope.findFirst({ where: { id: envelopeId, householdId } });
    if (!envelope || !canSee(envelope, membership)) {
      throw new HttpError(404, 'Envelope not found');
    }
    return envelope;
  }

  return {
    async create(
      userId: string,
      householdId: string,
      input: EnvelopeFields & { scope: EnvelopeScope },
    ) {
      const membership = await requireMembership(prisma, userId, householdId);
      if (input.scope === 'SHARED' && !(SHARED_MANAGERS as readonly string[]).includes(membership.role)) {
        throw new HttpError(403, 'Your role does not allow this');
      }
      return prisma.envelope.create({
        data: {
          ...input,
          householdId,
          ownerId: input.scope === 'PERSONAL' ? membership.id : null,
        },
      });
    },

    async list(userId: string, householdId: string) {
      const membership = await requireMembership(prisma, userId, householdId);
      return prisma.envelope.findMany({
        where: { householdId, OR: [{ scope: 'SHARED' }, { ownerId: membership.id }] },
        orderBy: { createdAt: 'asc' },
      });
    },

    async update(
      userId: string,
      householdId: string,
      envelopeId: string,
      changes: Partial<EnvelopeFields>,
    ) {
      const membership = await requireMembership(prisma, userId, householdId);
      const envelope = await findVisible(householdId, envelopeId, membership);
      assertCanManage(envelope, membership);
      return prisma.envelope.update({ where: { id: envelope.id }, data: changes });
    },

    // Transactions stay (their envelopeId is cleared by the FK) so history is kept.
    async remove(userId: string, householdId: string, envelopeId: string) {
      const membership = await requireMembership(prisma, userId, householdId);
      const envelope = await findVisible(householdId, envelopeId, membership);
      assertCanManage(envelope, membership);
      await prisma.envelope.delete({ where: { id: envelope.id } });
    },
  };
}

export type EnvelopeService = ReturnType<typeof createEnvelopeService>;
