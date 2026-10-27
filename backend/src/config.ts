import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  GOOGLE_CLIENT_ID: z.string().default(''),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().default(15 * 60),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(30),
  // AI features: the Gemini key lives only here, never in the app. Without it /ai/generate
  // answers 503 and the app reports AI as unavailable.
  GEMINI_API_KEY: z.string().default(''),
  GEMINI_MODEL: z.string().min(1).default('gemini-3.5-flash-lite'),
  // Requests per user per day. Protects the key (and its bill) from one account.
  AI_DAILY_LIMIT: z.coerce.number().int().positive().default(100),
  // The daily limit resets at midnight in this offset from UTC (default +05:30, India).
  AI_DAY_OFFSET_MINUTES: z.coerce.number().int().default(330),
  // How many reverse proxies sit between the internet and this server (Cloud Run: 1). 0 = none,
  // so client IPs are taken from the socket. Needed for the per-IP rate limit to tell users
  // apart. Only trust as many hops as really exist: more lets a caller spoof their address.
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
  // Most connections this server opens to Postgres. Small databases allow few (Cloud SQL's
  // smallest tier ~25), and every running instance has its own pool.
  DB_POOL_MAX: z.coerce.number().int().positive().default(5),
}).superRefine((value, ctx) => {
  if (value.NODE_ENV === 'production' && !value.GOOGLE_CLIENT_ID) {
    ctx.addIssue({
      code: 'custom',
      path: ['GOOGLE_CLIENT_ID'],
      message: 'GOOGLE_CLIENT_ID is required in production: without it every Google sign-in fails',
    });
  }
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return schema.parse(env);
}

export const config = loadConfig();
