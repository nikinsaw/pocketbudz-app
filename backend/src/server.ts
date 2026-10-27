import { buildApp } from './app.js';
import { createGoogleVerifier } from './auth/googleVerifier.js';
import { config } from './config.js';
import { prisma } from './db.js';
import { createServices } from './services.js';
import { shutdownOnSignals } from './shutdown.js';

const app = buildApp(createServices(prisma, createGoogleVerifier()), {
  trustProxyHops: config.TRUST_PROXY_HOPS,
  checkDatabase: () => prisma.$queryRaw`SELECT 1`,
});

shutdownOnSignals({ app, prisma });

app.listen({ port: config.PORT, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
