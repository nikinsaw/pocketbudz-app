import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../auth/authenticate.js';
import { CONSENT_VERSION, type HouseholdService } from './service.js';

const createBody = z.object({
  name: z.string().trim().min(1).max(60),
  consentVersion: z.string().min(1),
});
const inviteBody = z.object({ role: z.enum(['EARNER', 'SPENDER']) });
const joinBody = z.object({ code: z.string().min(1).max(64), consentVersion: z.string().min(1) });
const idParams = z.object({ id: z.string().min(1) });

export function registerHouseholdRoutes(app: FastifyInstance, households: HouseholdService) {
  // Public: the app shows this agreement version and sends it back on accept.
  app.get('/consent', async () => ({ version: CONSENT_VERSION }));

  const guarded = { preHandler: authenticate };

  app.post('/households', guarded, async (req, reply) => {
    const body = createBody.parse(req.body);
    const household = await households.create(req.userId, body);
    return reply.code(201).send(household);
  });

  app.get('/households', guarded, async (req) => households.listMine(req.userId));

  app.get('/households/:id/members', guarded, async (req) => {
    const { id } = idParams.parse(req.params);
    return households.listMembers(req.userId, id);
  });

  app.post('/households/:id/invites', guarded, async (req, reply) => {
    const { id } = idParams.parse(req.params);
    const { role } = inviteBody.parse(req.body);
    return reply.code(201).send(await households.createInvite(req.userId, id, role));
  });

  app.post(
    '/invites/join',
    { ...guarded, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (req) => households.join(req.userId, joinBody.parse(req.body)),
  );

  app.post('/households/:id/leave', guarded, async (req) => {
    const { id } = idParams.parse(req.params);
    return households.leave(req.userId, id);
  });
}
