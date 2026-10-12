import type { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../db.js';
import { verifyAccessToken } from './tokens.js';

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
  }
}

// preHandler for protected routes: requires `Authorization: Bearer <access token>`
// for an account that still exists. Access tokens outlive account deletion by up
// to their TTL, so the signature alone isn't enough.
export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const header = request.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  const userId = token ? await verifyAccessToken(token) : null;
  const user = userId
    ? await prisma.user.findUnique({ where: { id: userId }, select: { id: true, deletedAt: true } })
    : null;
  if (!user || user.deletedAt) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
  request.userId = user.id;
}
