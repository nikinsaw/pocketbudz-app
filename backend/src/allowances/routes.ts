import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../auth/authenticate.js';
import { MAX_PAISE } from '../money.js';
import type { AllowanceService } from './service.js';

const householdParams = z.object({ id: z.string().min(1) });
const spenderParams = householdParams.extend({ spenderId: z.string().min(1) });
const body = z.object({ amount: z.number().int().positive().max(MAX_PAISE) }); // paise per cycle

export function registerAllowanceRoutes(app: FastifyInstance, allowances: AllowanceService) {
  const guarded = { preHandler: authenticate };

  app.get('/households/:id/allowances', guarded, async (req) => {
    const { id } = householdParams.parse(req.params);
    return allowances.list(req.userId, id);
  });

  app.put('/households/:id/allowances/:spenderId', guarded, async (req) => {
    const { id, spenderId } = spenderParams.parse(req.params);
    return allowances.set(req.userId, id, spenderId, body.parse(req.body).amount);
  });

  app.delete('/households/:id/allowances/:spenderId', guarded, async (req, reply) => {
    const { id, spenderId } = spenderParams.parse(req.params);
    await allowances.remove(req.userId, id, spenderId);
    return reply.code(204).send();
  });
}
