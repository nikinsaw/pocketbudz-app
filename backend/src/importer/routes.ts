import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../auth/authenticate.js';
import type { ImportService } from './service.js';

const text = (max: number, fallback: string) =>
  z.string().transform((value) => value.trim().slice(0, max) || fallback);
const rupees = z.number().finite().min(0).max(100_000_000);

const body = z.object({
  envelopeScope: z.enum(['SHARED', 'PERSONAL']),
  monthlyIncome: rupees.nullable(),
  envelopes: z
    .array(
      z.object({
        categoryKey: text(40, 'other'),
        icon: text(16, '🧾'),
        title: text(40, 'Other'),
        colorKey: text(40, 'other'),
        type: text(20, 'spending'),
        budgetLimit: rupees,
      }),
    )
    .max(200),
  transactions: z
    .array(
      z.object({
        merchant: text(60, 'Unknown'),
        category: text(40, 'Other'),
        amount: rupees,
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD'),
      }),
    )
    .max(10_000),
});

export function registerImportRoutes(app: FastifyInstance, importer: ImportService) {
  app.post(
    '/households/:id/import',
    {
      preHandler: authenticate,
      bodyLimit: 5 * 1024 * 1024,
      config: { rateLimit: { max: 3, timeWindow: '1 minute' } },
    },
    async (req) => {
      const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
      return importer.importSolo(req.userId, id, body.parse(req.body));
    },
  );
}
