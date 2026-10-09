import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../db.js';
import { AuthError, createAuthService } from './service.js';
import { hashRefreshToken, verifyAccessToken } from './tokens.js';

const identity = { sub: 'google-sub-1', email: 'a@example.com', name: 'Asha' };
const service = createAuthService(prisma, async (idToken) => {
  if (idToken !== 'good') throw new Error('bad token');
  return identity;
});

beforeEach(async () => {
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
});
afterAll(() => prisma.$disconnect());

describe('loginWithGoogle', () => {
  it('creates a user and issues usable tokens', async () => {
    const session = await service.loginWithGoogle('good');
    expect(session.user.email).toBe('a@example.com');
    expect(await verifyAccessToken(session.accessToken)).toBe(session.user.id);
    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(session.refreshToken) },
    });
    expect(stored).not.toBeNull();
  });

  it('reuses the same user on a second login', async () => {
    const first = await service.loginWithGoogle('good');
    const second = await service.loginWithGoogle('good');
    expect(second.user.id).toBe(first.user.id);
    expect(await prisma.user.count()).toBe(1);
  });

  it('rejects an invalid Google token', async () => {
    await expect(service.loginWithGoogle('bad')).rejects.toBeInstanceOf(AuthError);
  });
});

describe('refresh', () => {
  it('rotates the refresh token', async () => {
    const session = await service.loginWithGoogle('good');
    const next = await service.refresh(session.refreshToken);
    expect(next.refreshToken).not.toBe(session.refreshToken);
    expect(await verifyAccessToken(next.accessToken)).toBe(session.user.id);
  });

  it('revokes every session when an old token is reused', async () => {
    const session = await service.loginWithGoogle('good');
    const next = await service.refresh(session.refreshToken);
    await expect(service.refresh(session.refreshToken)).rejects.toBeInstanceOf(AuthError);
    await expect(service.refresh(next.refreshToken)).rejects.toBeInstanceOf(AuthError);
  });

  it('rejects an unknown token', async () => {
    await expect(service.refresh('nope')).rejects.toBeInstanceOf(AuthError);
  });

  it('rejects an expired token', async () => {
    const session = await service.loginWithGoogle('good');
    await prisma.refreshToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(service.refresh(session.refreshToken)).rejects.toBeInstanceOf(AuthError);
  });
});

describe('logout', () => {
  it('revokes the refresh token', async () => {
    const session = await service.loginWithGoogle('good');
    await service.logout(session.refreshToken);
    await expect(service.refresh(session.refreshToken)).rejects.toBeInstanceOf(AuthError);
  });
});
