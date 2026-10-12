import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../auth/authenticate.js';
import type { MemberService } from './service.js';

const memberParams = z.object({ id: z.string().min(1), membershipId: z.string().min(1) });
const roleBody = z.object({ role: z.enum(['EARNER', 'SPENDER']) });

export function registerMemberRoutes(app: FastifyInstance, members: MemberService) {
  const guarded = { preHandler: authenticate };

  app.post('/households/:id/members/:membershipId/make-owner', guarded, async (req) => {
    const { id, membershipId } = memberParams.parse(req.params);
    return members.transferOwnership(req.userId, id, membershipId);
  });

  app.patch('/households/:id/members/:membershipId/role', guarded, async (req) => {
    const { id, membershipId } = memberParams.parse(req.params);
    return members.changeRole(req.userId, id, membershipId, roleBody.parse(req.body).role);
  });
}
