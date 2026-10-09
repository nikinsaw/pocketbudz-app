import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';

export function buildApp() {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' });
  app.register(helmet);
  app.register(cors, { origin: false });
  app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
  app.get('/health', async () => ({ status: 'ok' }));
  return app;
}
