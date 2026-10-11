import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../auth/authenticate.js';
import type { VisibilityService } from './service.js';

const householdParams = z.object({ id: z.string().min(1) });
// `viewer` is a membership id, or the literal "everyone".
const viewerParams = householdParams.extend({ viewer: z.string().min(1) });
const setBody = z.object({ level: z.enum(['NONE', 'TOTAL', 'FULL']) });

export function registerVisibilityRoutes(app: FastifyInstance, visibility: VisibilityService) {
  const guarded = { preHandler: authenticate };

  app.get('/households/:id/visibility', guarded, async (req) => {
    const { id } = householdParams.parse(req.params);
    return visibility.overview(req.userId, id);
  });

  app.put('/households/:id/visibility/:viewer', guarded, async (req) => {
    const { id, viewer } = viewerParams.parse(req.params);
    const { level } = setBody.parse(req.body);
    return visibility.set(req.userId, id, viewer, level);
  });

  app.delete('/households/:id/visibility/:viewer', guarded, async (req, reply) => {
    const { id, viewer } = viewerParams.parse(req.params);
    await visibility.reset(req.userId, id, viewer);
    return reply.code(204).send();
  });
}
