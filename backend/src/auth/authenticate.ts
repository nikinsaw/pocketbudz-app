import type { FastifyReply, FastifyRequest } from 'fastify';
import { verifyAccessToken } from './tokens.js';

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
  }
}

// preHandler for protected routes: requires `Authorization: Bearer <access token>`.
export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const header = request.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  const userId = token ? await verifyAccessToken(token) : null;
  if (!userId) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
  request.userId = userId;
}
