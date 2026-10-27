import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

const base = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_SECRET: 'x'.repeat(32),
};

describe('loadConfig', () => {
  it('has safe defaults for a local run', () => {
    const c = loadConfig(base);
    expect(c).toMatchObject({
      NODE_ENV: 'development', PORT: 3000, TRUST_PROXY_HOPS: 0, DB_POOL_MAX: 5, AI_DAILY_LIMIT: 100, GEMINI_API_KEY: '',
    });
  });

  it('reads PORT from the environment (Cloud Run sets it)', () => {
    expect(loadConfig({ ...base, PORT: '8080' }).PORT).toBe(8080);
  });

  it('refuses a short or missing JWT secret, and a missing database', () => {
    expect(() => loadConfig({ ...base, JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/);
    expect(() => loadConfig({ DATABASE_URL: base.DATABASE_URL })).toThrow();
    expect(() => loadConfig({ JWT_SECRET: base.JWT_SECRET })).toThrow(/DATABASE_URL/);
  });

  describe('production', () => {
    it('refuses to start without a Google client ID, naming the problem', () => {
      expect(() => loadConfig({ ...base, NODE_ENV: 'production' })).toThrow(/GOOGLE_CLIENT_ID is required in production/);
      expect(() => loadConfig({ ...base, NODE_ENV: 'production', GOOGLE_CLIENT_ID: '' })).toThrow(/GOOGLE_CLIENT_ID/);
    });

    it('starts with one', () => {
      expect(loadConfig({ ...base, NODE_ENV: 'production', GOOGLE_CLIENT_ID: 'abc.apps.googleusercontent.com' }).NODE_ENV).toBe('production');
    });

    it('does not require it in development or tests', () => {
      expect(() => loadConfig({ ...base, NODE_ENV: 'development' })).not.toThrow();
      expect(() => loadConfig({ ...base, NODE_ENV: 'test' })).not.toThrow();
    });

    it('does not require a Gemini key - AI is optional and just reports unavailable', () => {
      expect(() => loadConfig({ ...base, NODE_ENV: 'production', GOOGLE_CLIENT_ID: 'x' })).not.toThrow();
    });
  });

  describe('proxy trust and pool size', () => {
    it('accepts the number of proxy hops', () => {
      expect(loadConfig({ ...base, TRUST_PROXY_HOPS: '1' }).TRUST_PROXY_HOPS).toBe(1);
      expect(loadConfig({ ...base, TRUST_PROXY_HOPS: '0' }).TRUST_PROXY_HOPS).toBe(0);
    });

    it.each(['-1', '1.5', 'many'])('rejects proxy hops of %s', (hops) => {
      expect(() => loadConfig({ ...base, TRUST_PROXY_HOPS: hops })).toThrow();
    });

    it('accepts a pool size, and rejects zero, negative or fractional', () => {
      expect(loadConfig({ ...base, DB_POOL_MAX: '3' }).DB_POOL_MAX).toBe(3);
      for (const bad of ['0', '-2', '2.5']) {
        expect(() => loadConfig({ ...base, DB_POOL_MAX: bad })).toThrow();
      }
    });
  });
});
