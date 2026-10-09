import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { registerAuthRoutes } from './auth/routes.js';
import type { AuthService } from './auth/service.js';

export interface AppDeps {
  auth: AuthService;
}

export function buildApp(deps: AppDeps) {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' });
  app.register(helmet);
  app.register(cors, { origin: false });
  app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
  app.get('/health', async () => ({ status: 'ok' }));
  app.register(async (instance) => registerAuthRoutes(instance, deps.auth));
  return app;
}
