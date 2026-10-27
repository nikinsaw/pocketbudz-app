import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from './config.js';

export const prisma = new PrismaClient({
  // Each Cloud Run instance holds its own pool, so keep it small to stay under Cloud SQL's
  // connection limit when several instances run at once.
  adapter: new PrismaPg({ connectionString: config.DATABASE_URL, max: config.DB_POOL_MAX }),
});
