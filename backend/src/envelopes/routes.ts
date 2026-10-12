import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../auth/authenticate.js';
import { MAX_PAISE } from '../money.js';
import type { EnvelopeService } from './service.js';

const fields = z.object({
  categoryKey: z.string().trim().min(1).max(40),
  icon: z.string().trim().min(1).max(16),
  title: z.string().trim().min(1).max(40),
  colorKey: z.string().trim().min(1).max(40),
  type: z.string().trim().min(1).max(20),
  budgetLimit: z.number().int().min(0).max(MAX_PAISE),
});
const createBody = fields.extend({ scope: z.enum(['SHARED', 'PERSONAL']) });
const updateBody = fields.partial().refine((v) => Object.keys(v).length > 0, 'No changes');
const householdParams = z.object({ id: z.string().min(1) });
const envelopeParams = householdParams.extend({ envelopeId: z.string().min(1) });

export function registerEnvelopeRoutes(app: FastifyInstance, envelopes: EnvelopeService) {
  const guarded = { preHandler: authenticate };

  app.post('/households/:id/envelopes', guarded, async (req, reply) => {
    const { id } = householdParams.parse(req.params);
    const body = createBody.parse(req.body);
    return reply.code(201).send(await envelopes.create(req.userId, id, body));
  });

  app.get('/households/:id/envelopes', guarded, async (req) => {
    const { id } = householdParams.parse(req.params);
    return envelopes.list(req.userId, id);
  });

  app.patch('/households/:id/envelopes/:envelopeId', guarded, async (req) => {
    const { id, envelopeId } = envelopeParams.parse(req.params);
    return envelopes.update(req.userId, id, envelopeId, updateBody.parse(req.body));
  });

  app.delete('/households/:id/envelopes/:envelopeId', guarded, async (req, reply) => {
    const { id, envelopeId } = envelopeParams.parse(req.params);
    await envelopes.remove(req.userId, id, envelopeId);
    return reply.code(204).send();
  });
}
