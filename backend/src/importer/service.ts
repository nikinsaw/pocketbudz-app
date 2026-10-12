import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { HttpError } from '../errors.js';
import { requireMembership } from '../households/access.js';
import { MAX_PAISE, rupeesToPaise } from '../money.js';
import { parseDate } from '../transactions/service.js';
import { isEarner, levelsForOwner } from '../visibility/resolve.js';

// The shape of a solo user's on-device data. Amounts are in rupees, as the app
// stores them; they are converted to paise here.
export interface SoloData {
  envelopeScope: 'SHARED' | 'PERSONAL';
  monthlyIncome: number | null;
  envelopes: { categoryKey: string; icon: string; title: string; colorKey: string; type: string; budgetLimit: number }[];
  transactions: { merchant: string; category: string; amount: number; date: string }[];
}

function toPaise(rupees: number, what: string) {
  const paise = rupeesToPaise(rupees);
  if (!Number.isSafeInteger(paise) || paise < 0 || paise > MAX_PAISE) {
    throw new HttpError(400, `${what} is out of range`);
  }
  return paise;
}

export function createImportService(prisma: PrismaClient) {
  return {
    // One-time upload of the caller's solo data into the household. Their envelopes
    // become shared or personal as chosen, transactions attach to the envelope whose
    // title matches the category (as the app does), and monthly income becomes an
    // income source for earners. All or nothing; a second upload is refused.
    async importSolo(userId: string, householdId: string, data: SoloData) {
      const me = await requireMembership(prisma, userId, householdId);
      if (data.envelopeScope === 'SHARED' && !isEarner(me.role)) {
        throw new HttpError(403, 'Only owners and earners can import shared envelopes');
      }

      // Validate and convert everything before touching the database.
      const envelopes = data.envelopes.map((e, i) => ({
        id: randomUUID(),
        householdId,
        scope: data.envelopeScope,
        ownerId: data.envelopeScope === 'PERSONAL' ? me.id : null,
        categoryKey: e.categoryKey,
        icon: e.icon,
        title: e.title,
        colorKey: e.colorKey,
        type: e.type,
        budgetLimit: toPaise(e.budgetLimit, `Envelope ${i + 1} budget`),
      }));
      const envelopeByTitle = new Map<string, (typeof envelopes)[number]>();
      for (const envelope of envelopes) {
        const key = envelope.title.toLowerCase();
        if (!envelopeByTitle.has(key)) envelopeByTitle.set(key, envelope);
      }
      const transactions = data.transactions.map((t, i) => {
        const amount = toPaise(t.amount, `Transaction ${i + 1} amount`);
        if (amount < 1) throw new HttpError(400, `Transaction ${i + 1} amount is too small`);
        const envelope = envelopeByTitle.get(t.category.toLowerCase()) ?? null;
        return {
          id: randomUUID(),
          householdId,
          memberId: me.id,
          envelopeId: envelope?.id ?? null,
          merchant: t.merchant,
          category: t.category,
          amount,
          date: parseDate(t.date),
          private: !envelope || envelope.scope === 'PERSONAL',
        };
      });
      const income =
        data.monthlyIncome && isEarner(me.role) ? toPaise(data.monthlyIncome, 'Monthly income') : 0;

      await prisma.$transaction(
        async (tx) => {
          // Atomic one-time claim, so a retry or double-tap can't import twice.
          const claimed = await tx.membership.updateMany({
            where: { id: me.id, importedAt: null },
            data: { importedAt: new Date() },
          });
          if (claimed.count === 0) {
            throw new HttpError(409, 'You have already imported your data');
          }
          await tx.envelope.createMany({ data: envelopes });
          await tx.transaction.createMany({
            data: transactions.map(({ private: _private, ...row }) => row),
          });
          // Private spending is stamped from the importer's current sharing settings,
          // exactly as if each transaction had been added by hand.
          const levels = (await levelsForOwner(tx, me)).filter((l) => l.level !== 'NONE');
          const stamps = transactions
            .filter((t) => t.private)
            .flatMap((t) => levels.map((l) => ({ transactionId: t.id, viewerId: l.viewerId, level: l.level })));
          if (stamps.length > 0) await tx.transactionVisibility.createMany({ data: stamps });
          if (income > 0) {
            await tx.incomeSource.create({
              data: { householdId, memberId: me.id, label: 'Monthly income (imported)', amount: income },
            });
          }
        },
        { timeout: 30_000 },
      );

      return {
        envelopes: envelopes.length,
        transactions: transactions.length,
        incomeImported: income > 0,
      };
    },
  };
}

export type ImportService = ReturnType<typeof createImportService>;
