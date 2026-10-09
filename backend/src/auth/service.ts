import type { PrismaClient, User } from '@prisma/client';
import { config } from '../config.js';
import type { GoogleVerifier } from './googleVerifier.js';
import { generateRefreshToken, hashRefreshToken, signAccessToken } from './tokens.js';

export class AuthError extends Error {}

export interface Session {
  accessToken: string;
  refreshToken: string;
  user: Pick<User, 'id' | 'email' | 'name'>;
}

export function createAuthService(prisma: PrismaClient, verifyGoogle: GoogleVerifier) {
  async function issueSession(user: Pick<User, 'id' | 'email' | 'name'>): Promise<Session> {
    const { token, hash } = generateRefreshToken();
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hash,
        expiresAt: new Date(Date.now() + config.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
      },
    });
    return {
      accessToken: await signAccessToken(user.id),
      refreshToken: token,
      user: { id: user.id, email: user.email, name: user.name },
    };
  }

  return {
    async loginWithGoogle(idToken: string): Promise<Session> {
      let identity;
      try {
        identity = await verifyGoogle(idToken);
      } catch {
        throw new AuthError('Invalid Google token');
      }
      const user = await prisma.user.upsert({
        where: { googleSub: identity.sub },
        update: { email: identity.email, name: identity.name, deletedAt: null },
        create: { googleSub: identity.sub, email: identity.email, name: identity.name },
      });
      return issueSession(user);
    },

    // Rotates: the presented token is revoked and a fresh one issued. Presenting
    // an already-revoked token means it leaked, so every session is revoked.
    async refresh(refreshToken: string): Promise<Session> {
      const record = await prisma.refreshToken.findUnique({
        where: { tokenHash: hashRefreshToken(refreshToken) },
        include: { user: true },
      });
      if (!record || record.user.deletedAt) {
        throw new AuthError('Invalid refresh token');
      }
      if (record.revokedAt) {
        await prisma.refreshToken.updateMany({
          where: { userId: record.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        throw new AuthError('Refresh token reuse detected');
      }
      if (record.expiresAt <= new Date()) {
        throw new AuthError('Refresh token expired');
      }
      // Conditional update guards against two concurrent refreshes of one token.
      const claimed = await prisma.refreshToken.updateMany({
        where: { id: record.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (claimed.count === 0) {
        throw new AuthError('Invalid refresh token');
      }
      return issueSession(record.user);
    },

    async logout(refreshToken: string): Promise<void> {
      await prisma.refreshToken.updateMany({
        where: { tokenHash: hashRefreshToken(refreshToken), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
