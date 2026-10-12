import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../auth/authenticate.js';
import type { AccountService } from './service.js';

export function registerAccountRoutes(app: FastifyInstance, account: AccountService) {
  const guarded = { preHandler: authenticate };

  app.get('/me/export', guarded, async (req) => account.exportAccount(req.userId));

  // Irreversible, so the client must send an explicit confirmation word.
  app.delete(
    '/me',
    { ...guarded, config: { rateLimit: { max: 3, timeWindow: '1 minute' } } },
    async (req, reply) => {
      z.object({ confirm: z.literal('DELETE') }).parse(req.body);
      await account.deleteAccount(req.userId);
      return reply.code(204).send();
    },
  );

  app.get('/households/:id/export', guarded, async (req) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    return account.exportHousehold(req.userId, id);
  });
}
