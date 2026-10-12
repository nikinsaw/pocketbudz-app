import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../auth/authenticate.js';
import { MAX_PAISE } from '../money.js';
import type { IncomeService } from './service.js';

const fields = z.object({
  label: z.string().trim().min(1).max(60),
  amount: z.number().int().positive().max(MAX_PAISE), // paise per cycle
});
const updateBody = fields.partial().refine((v) => Object.keys(v).length > 0, 'No changes');
const householdParams = z.object({ id: z.string().min(1) });
const incomeParams = householdParams.extend({ incomeId: z.string().min(1) });

export function registerIncomeRoutes(app: FastifyInstance, income: IncomeService) {
  const guarded = { preHandler: authenticate };

  app.post('/households/:id/income', guarded, async (req, reply) => {
    const { id } = householdParams.parse(req.params);
    return reply.code(201).send(await income.create(req.userId, id, fields.parse(req.body)));
  });

  app.get('/households/:id/income', guarded, async (req) => {
    const { id } = householdParams.parse(req.params);
    return income.list(req.userId, id);
  });

  app.patch('/households/:id/income/:incomeId', guarded, async (req) => {
    const { id, incomeId } = incomeParams.parse(req.params);
    return income.update(req.userId, id, incomeId, updateBody.parse(req.body));
  });

  app.delete('/households/:id/income/:incomeId', guarded, async (req, reply) => {
    const { id, incomeId } = incomeParams.parse(req.params);
    await income.remove(req.userId, id, incomeId);
    return reply.code(204).send();
  });
}
