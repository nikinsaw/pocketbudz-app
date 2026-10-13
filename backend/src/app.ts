import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { ZodError } from 'zod';
import { HttpError } from './errors.js';
import { registerAccountRoutes } from './account/routes.js';
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

export function buildApp(deps: Services) {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' });
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof HttpError) return reply.code(err.status).send({ ...err.extra, error: err.message });
    if (err instanceof ZodError) return reply.code(400).send({ error: 'Invalid request' });
    reply.send(err);
  });
  app.register(helmet);
  app.register(cors, { origin: false });
  app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
  app.get('/health', async () => ({ status: 'ok' }));
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
  return app;
}
