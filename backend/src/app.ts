import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { ZodError } from 'zod';
import { HttpError } from './errors.js';
import { cloudLoggerOptions } from './logging.js';
import { registerAccountRoutes } from './account/routes.js';
import { registerAiRoutes } from './ai/routes.js';
import { registerAllowanceRoutes } from './allowances/routes.js';
import { registerDashboardRoutes } from './dashboard/routes.js';
import { registerAuthRoutes } from './auth/routes.js';
import { registerEnvelopeRoutes } from './envelopes/routes.js';
import { registerHouseholdRoutes } from './households/routes.js';
import { registerImportRoutes } from './importer/routes.js';
import { registerIncomeRoutes } from './income/routes.js';
import { registerMemberRoutes } from './members/routes.js';
import type { Services } from './services.js';
import { registerTransactionRoutes } from './transactions/routes.js';
import { registerVisibilityRoutes } from './visibility/routes.js';

export interface AppOptions {
  // Reverse proxies in front of the server (Cloud Run: 1), so the rate limit sees each
  // caller's real address instead of the proxy's. 0 = none.
  trustProxyHops?: number;
  // Used by GET /ready to confirm the database answers. Omitted in tests.
  checkDatabase?: () => Promise<unknown>;
}

export function buildApp(deps: Services, options: AppOptions = {}) {
  const env = process.env.NODE_ENV;
  const hops = options.trustProxyHops ?? 0;
  const app = Fastify({
    logger: env === 'test' ? false : env === 'production' ? cloudLoggerOptions : true,
    // Trust exactly the first `hops` proxies (hop 0 is whoever connected to us). The caller's
    // address is then the entry in X-Forwarded-For just beyond those, i.e. the one the
    // outermost trusted proxy added itself - anything a client put earlier in the header is
    // ignored, so it can't be used to dodge the rate limit.
    trustProxy: hops > 0 ? (_address: string, hop: number) => hop < hops : false,
  });
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof HttpError) return reply.code(err.status).send({ ...err.extra, error: err.message });
    if (err instanceof ZodError) return reply.code(400).send({ error: 'Invalid request' });
    reply.send(err);
  });
  app.register(helmet);
  app.register(cors, { origin: false });
  app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
  // The platform polls these constantly, so they are not rate limited.
  // /health: the process is up. /ready: it can also reach the database.
  app.get('/health', { config: { rateLimit: false } }, async () => ({ status: 'ok' }));
  app.get('/ready', { config: { rateLimit: false } }, async (_req, reply) => {
    try {
      await options.checkDatabase?.();
      return { status: 'ready' };
    } catch (error) {
      app.log.error({ err: error }, 'database check failed');
      return reply.code(503).send({ status: 'unavailable' });
    }
  });
  app.register(async (instance) => registerAuthRoutes(instance, deps.auth));
  app.register(async (instance) => registerHouseholdRoutes(instance, deps.households));
  app.register(async (instance) => registerEnvelopeRoutes(instance, deps.envelopes));
  app.register(async (instance) => registerTransactionRoutes(instance, deps.transactions));
  app.register(async (instance) => registerIncomeRoutes(instance, deps.income));
  app.register(async (instance) => registerVisibilityRoutes(instance, deps.visibility));
  app.register(async (instance) => registerAllowanceRoutes(instance, deps.allowances));
  app.register(async (instance) => registerMemberRoutes(instance, deps.members));
  app.register(async (instance) => registerImportRoutes(instance, deps.importer));
  app.register(async (instance) => registerAccountRoutes(instance, deps.account));
  app.register(async (instance) => registerDashboardRoutes(instance, deps.dashboard));
  app.register(async (instance) => registerAiRoutes(instance, deps.ai));
  return app;
}
