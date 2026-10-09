import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { createAuthService } from './auth/service.js';
import { prisma } from './db.js';
import { createHouseholdService } from './households/service.js';

const auth = createAuthService(prisma, async (idToken) => {
  if (idToken !== 'good') throw new Error('bad token');
  return { sub: 'google-sub-1', email: 'a@example.com', name: 'Asha' };
});
const app = buildApp({ auth, households: createHouseholdService(prisma) });

beforeEach(async () => {
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe('app', () => {
  it('responds to /health', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });
});

describe('auth routes', () => {
  const login = () =>
    app.inject({ method: 'POST', url: '/auth/google', payload: { idToken: 'good' } });

  it('logs in and reaches a protected route', async () => {
    const res = await login();
    expect(res.statusCode).toBe(200);
    const { accessToken, user } = res.json();
    const me = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toEqual({ userId: user.id });
  });

  it('rejects a bad Google token with 401', async () => {
    const res = await app.inject({ method: 'POST', url: '/auth/google', payload: { idToken: 'bad' } });
    expect(res.statusCode).toBe(401);
  });

  it('rejects a malformed body with 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/auth/google', payload: {} });
    expect(res.statusCode).toBe(400);
  });

  it('blocks protected routes without a valid token', async () => {
    expect((await app.inject({ method: 'GET', url: '/me' })).statusCode).toBe(401);
    const bad = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: 'Bearer nope' },
    });
    expect(bad.statusCode).toBe(401);
  });

  it('refreshes and then logs out', async () => {
    const { refreshToken } = (await login()).json();
    const refreshed = await app.inject({ method: 'POST', url: '/auth/refresh', payload: { refreshToken } });
    expect(refreshed.statusCode).toBe(200);
    const next = refreshed.json().refreshToken;
    const out = await app.inject({ method: 'POST', url: '/auth/logout', payload: { refreshToken: next } });
    expect(out.statusCode).toBe(204);
    const again = await app.inject({ method: 'POST', url: '/auth/refresh', payload: { refreshToken: next } });
    expect(again.statusCode).toBe(401);
  });
});
