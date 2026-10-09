import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from './authenticate.js';
import type { AuthService } from './service.js';

const googleBody = z.object({ idToken: z.string().min(1) });
const refreshBody = z.object({ refreshToken: z.string().min(1) });

export function registerAuthRoutes(app: FastifyInstance, auth: AuthService) {
  // Stricter limit than the global one: these endpoints are brute-force targets.
  const limit = { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } };

  app.post('/auth/google', limit, async (req) => {
    const { idToken } = googleBody.parse(req.body);
    return auth.loginWithGoogle(idToken);
  });

  app.post('/auth/refresh', limit, async (req) => {
    const { refreshToken } = refreshBody.parse(req.body);
    return auth.refresh(refreshToken);
  });

  app.post('/auth/logout', limit, async (req, reply) => {
    const { refreshToken } = refreshBody.parse(req.body);
    await auth.logout(refreshToken);
    return reply.code(204).send();
  });

  app.get('/me', { preHandler: authenticate }, async (req) => ({ userId: req.userId }));
}
