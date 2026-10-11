import { buildApp } from './app.js';
import { createGoogleVerifier } from './auth/googleVerifier.js';
import { config } from './config.js';
import { prisma } from './db.js';
import { createServices } from './services.js';

const app = buildApp(createServices(prisma, createGoogleVerifier()));

app.listen({ port: config.PORT, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
