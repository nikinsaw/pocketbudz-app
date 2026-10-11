import type { Membership, PrismaClient } from '@prisma/client';
import { HttpError } from '../errors.js';
import { requireMembership } from '../households/access.js';
import { clearVisibility, stampVisibility } from '../visibility/stamp.js';

export interface TransactionFields {
  envelopeId: string | null;
  merchant: string;
  category: string;
  amount: number; // paise, positive
  date: string; // YYYY-MM-DD
}

// Rejects impossible dates like 2026-02-31 by round-tripping.
export function parseDate(date: string): Date {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new HttpError(400, 'Invalid date');
  }
  return parsed;
}

export function createTransactionService(prisma: PrismaClient) {
  // A member may only book against shared envelopes or their own personal ones.
  async function assertEnvelopeUsable(householdId: string, envelopeId: string, membership: Membership) {
    const envelope = await prisma.envelope.findFirst({ where: { id: envelopeId, householdId } });
    if (!envelope || (envelope.scope === 'PERSONAL' && envelope.ownerId !== membership.id)) {
      throw new HttpError(404, 'Envelope not found');
    }
    return envelope;
  }

  // Spending outside a shared envelope is private and gets visibility stamps.
  const isPrivate = (envelope: { scope: string } | null) => !envelope || envelope.scope === 'PERSONAL';

  async function findOwn(householdId: string, transactionId: string, membership: Membership) {
    const transaction = await prisma.transaction.findFirst({
      where: { id: transactionId, householdId },
      include: { envelope: true, visibility: { where: { viewerId: membership.id, level: 'FULL' } } },
    });
    const visible =
      transaction &&
      (transaction.memberId === membership.id ||
        transaction.envelope?.scope === 'SHARED' ||
        transaction.visibility.length > 0);
    if (!transaction || !visible) {
      throw new HttpError(404, 'Transaction not found');
    }
    if (transaction.memberId !== membership.id) {
      throw new HttpError(403, 'Only the person who added this can change it');
    }
    return transaction;
  }

  function present(
    t: {
      id: string; merchant: string; category: string; amount: number; date: Date;
      envelopeId: string | null; memberId: string | null;
      member: { id: string; user: { name: string } | null } | null;
    },
    membership: Membership,
  ) {
    return {
      id: t.id,
      merchant: t.merchant,
      category: t.category,
      amount: t.amount,
      date: t.date.toISOString().slice(0, 10),
      envelopeId: t.envelopeId,
      mine: t.memberId === membership.id,
      member: { membershipId: t.memberId, name: t.member?.user?.name ?? 'Former member' },
    };
  }

  const include = { member: { select: { id: true, user: { select: { name: true } } } } } as const;

  return {
    async create(userId: string, householdId: string, input: TransactionFields) {
      const membership = await requireMembership(prisma, userId, householdId);
      const envelope = input.envelopeId
        ? await assertEnvelopeUsable(householdId, input.envelopeId, membership)
        : null;
      const created = await prisma.$transaction(async (tx) => {
        const row = await tx.transaction.create({
          data: {
            householdId,
            memberId: membership.id,
            envelopeId: input.envelopeId,
            merchant: input.merchant,
            category: input.category,
            amount: input.amount,
            date: parseDate(input.date),
          },
          include,
        });
        if (isPrivate(envelope)) {
          await stampVisibility(tx, row.id, membership);
        }
        return row;
      });
      return present(created, membership);
    },

    // What this member may see: their own spending, everything in shared envelopes,
    // and other members' private spending that was shared with them in full.
    // (Totals-only spending is reported by the spending summary, never itemised.)
    async list(
      userId: string,
      householdId: string,
      range: { from?: string; to?: string; limit?: number } = {},
    ) {
      const membership = await requireMembership(prisma, userId, householdId);
      const rows = await prisma.transaction.findMany({
        where: {
          householdId,
          OR: [
            { memberId: membership.id },
            { envelope: { scope: 'SHARED' } },
            { visibility: { some: { viewerId: membership.id, level: 'FULL' } } },
          ],
          date: {
            ...(range.from ? { gte: parseDate(range.from) } : {}),
            ...(range.to ? { lte: parseDate(range.to) } : {}),
          },
        },
        include,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: Math.min(range.limit ?? 200, 500),
      });
      return rows.map((row) => present(row, membership));
    },

    async update(
      userId: string,
      householdId: string,
      transactionId: string,
      changes: Partial<TransactionFields>,
    ) {
      const membership = await requireMembership(prisma, userId, householdId);
      const existing = await findOwn(householdId, transactionId, membership);
      const movedEnvelope = changes.envelopeId !== undefined;
      const envelope = changes.envelopeId
        ? await assertEnvelopeUsable(householdId, changes.envelopeId, membership)
        : null;
      const updated = await prisma.$transaction(async (tx) => {
        const row = await tx.transaction.update({
          where: { id: existing.id },
          data: {
            ...(movedEnvelope ? { envelopeId: changes.envelopeId } : {}),
            ...(changes.merchant !== undefined ? { merchant: changes.merchant } : {}),
            ...(changes.category !== undefined ? { category: changes.category } : {}),
            ...(changes.amount !== undefined ? { amount: changes.amount } : {}),
            ...(changes.date !== undefined ? { date: parseDate(changes.date) } : {}),
          },
          include,
        });
        // Moving between private and shared (or between envelopes) re-stamps from today's settings.
        if (movedEnvelope) {
          if (isPrivate(envelope)) await stampVisibility(tx, row.id, membership);
          else await clearVisibility(tx, row.id);
        }
        return row;
      });
      return present(updated, membership);
    },

    async remove(userId: string, householdId: string, transactionId: string) {
      const membership = await requireMembership(prisma, userId, householdId);
      const existing = await findOwn(householdId, transactionId, membership);
      await prisma.transaction.delete({ where: { id: existing.id } });
    },
  };
}

export type TransactionService = ReturnType<typeof createTransactionService>;
