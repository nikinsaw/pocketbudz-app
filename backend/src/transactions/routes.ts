import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../auth/authenticate.js';
import type { TransactionService } from './service.js';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD');
const fields = z.object({
  envelopeId: z.string().min(1).nullable(),
  merchant: z.string().trim().min(1).max(60),
  category: z.string().trim().min(1).max(40),
  amount: z.number().int().positive().max(100_000_000_00), // paise
  date: isoDate,
});
const updateBody = fields.partial().refine((v) => Object.keys(v).length > 0, 'No changes');
const listQuery = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});
const householdParams = z.object({ id: z.string().min(1) });
const transactionParams = householdParams.extend({ transactionId: z.string().min(1) });

export function registerTransactionRoutes(app: FastifyInstance, transactions: TransactionService) {
  const guarded = { preHandler: authenticate };

  app.post('/households/:id/transactions', guarded, async (req, reply) => {
    const { id } = householdParams.parse(req.params);
    const body = fields.parse(req.body);
    return reply.code(201).send(await transactions.create(req.userId, id, body));
  });

  app.get('/households/:id/transactions', guarded, async (req) => {
    const { id } = householdParams.parse(req.params);
    return transactions.list(req.userId, id, listQuery.parse(req.query));
  });

  app.patch('/households/:id/transactions/:transactionId', guarded, async (req) => {
    const { id, transactionId } = transactionParams.parse(req.params);
    return transactions.update(req.userId, id, transactionId, updateBody.parse(req.body));
  });

  app.delete('/households/:id/transactions/:transactionId', guarded, async (req, reply) => {
    const { id, transactionId } = transactionParams.parse(req.params);
    await transactions.remove(req.userId, id, transactionId);
    return reply.code(204).send();
  });
}
