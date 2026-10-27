import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp, type AppOptions } from './app.js';
import { cloudLoggerOptions, cloudSeverity } from './logging.js';
import { createServices } from './services.js';
import { prisma } from './db.js';

const services = createServices(prisma, async () => { throw new Error('unused'); });
let app: ReturnType<typeof buildApp>;
const make = (options?: AppOptions) => (app = buildApp(services, options));
afterEach(() => app?.close());

// A caller behind Google's front end: the front end connects from 10.0.0.1 and appends the
// caller's real address to X-Forwarded-For - after anything the caller put there themselves.
const as = (realIp: string, spoofed = '1.2.3.4') => ({
  method: 'GET' as const,
  url: '/consent', // public and rate limited
  remoteAddress: '10.0.0.1',
  headers: { 'x-forwarded-for': `${spoofed}, ${realIp}` },
});
const hit = async (times: number, request: ReturnType<typeof as>) => {
  let last = 200;
  for (let i = 0; i < times; i++) last = (await app.inject(request)).statusCode;
  return last;
};

// Each test makes 100+ requests to exhaust a rate limit, so give them room.
describe('rate limiting behind a proxy', { timeout: 30_000 }, () => {
  it('with one trusted hop, each real caller gets their own allowance', async () => {
    make({ trustProxyHops: 1 });
    expect(await hit(100, as('203.0.113.1'))).toBe(200);
    expect(await hit(1, as('203.0.113.1'))).toBe(429); // caller A used theirs up...
    expect(await hit(1, as('203.0.113.2'))).toBe(200); // ...caller B is unaffected
  });

  it('a caller cannot dodge the limit by sending a different fake address each time', async () => {
    make({ trustProxyHops: 1 });
    for (let i = 0; i < 100; i++) await app.inject(as('203.0.113.9', `9.9.9.${i}`));
    expect((await app.inject(as('203.0.113.9', '8.8.8.8'))).statusCode).toBe(429);
  });

  it('with no trusted proxy the header is ignored, so everyone shares the proxy’s allowance (the bug this prevents)', async () => {
    make({ trustProxyHops: 0 });
    expect(await hit(100, as('203.0.113.1'))).toBe(200);
    expect((await app.inject(as('203.0.113.2'))).statusCode).toBe(429); // an innocent bystander is blocked
  });

  it('defaults to not trusting any proxy', async () => {
    make();
    await hit(100, as('203.0.113.1'));
    expect((await app.inject(as('203.0.113.2'))).statusCode).toBe(429);
  });
});

describe('health and readiness', { timeout: 30_000 }, () => {
  it('/health says the process is up and is never rate limited', async () => {
    make();
    for (let i = 0; i < 150; i++) expect((await app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200);
  });

  it('/ready is ready when the database answers', async () => {
    const checkDatabase = vi.fn(async () => 1);
    make({ checkDatabase });
    const res = await app.inject({ method: 'GET', url: '/ready' });
    expect([res.statusCode, res.json()]).toEqual([200, { status: 'ready' }]);
    expect(checkDatabase).toHaveBeenCalledTimes(1);
  });

  it('/ready says 503 when the database does not answer - and does not leak why', async () => {
    make({ checkDatabase: async () => { throw new Error('password authentication failed for user "pocketbudz" at 10.1.2.3'); } });
    const res = await app.inject({ method: 'GET', url: '/ready' });
    expect(res.statusCode).toBe(503);
    expect(res.body).toBe('{"status":"unavailable"}');
  });

  it('/ready is never rate limited either', async () => {
    make({ checkDatabase: async () => 1 });
    for (let i = 0; i < 150; i++) expect((await app.inject({ method: 'GET', url: '/ready' })).statusCode).toBe(200);
  });
});

describe('production logging for Google Cloud', () => {
  it('maps log levels to Cloud Logging severities', () => {
    expect(['trace', 'debug', 'info', 'warn', 'error', 'fatal'].map(cloudSeverity)).toEqual(['DEBUG', 'DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL']);
    expect(cloudSeverity('something-new')).toBe('DEFAULT');
  });

  it('writes severity and message, no pid/hostname, and an ISO time', () => {
    expect(cloudLoggerOptions.messageKey).toBe('message');
    expect(cloudLoggerOptions.base).toBeNull();
    expect(cloudLoggerOptions.formatters.level('error')).toEqual({ severity: 'ERROR' });
    expect(cloudLoggerOptions.timestamp()).toMatch(/^,"time":"\d{4}-\d{2}-\d{2}T[\d:.]+Z"$/);
  });
});
