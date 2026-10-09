import { buildApp } from './app.js';
import { createGoogleVerifier } from './auth/googleVerifier.js';
import { createAuthService } from './auth/service.js';
import { config } from './config.js';
import { prisma } from './db.js';

const app = buildApp({ auth: createAuthService(prisma, createGoogleVerifier()) });

app.listen({ port: config.PORT, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
