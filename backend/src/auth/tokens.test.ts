import { describe, it, expect } from 'vitest';
import { SignJWT } from 'jose';
import { generateRefreshToken, hashRefreshToken, signAccessToken, verifyAccessToken } from './tokens.js';

describe('access tokens', () => {
  it('round-trips the user id', async () => {
    const token = await signAccessToken('user_1');
    expect(await verifyAccessToken(token)).toBe('user_1');
  });

  it('rejects garbage', async () => {
    expect(await verifyAccessToken('not-a-jwt')).toBeNull();
  });

  it('rejects a token signed with a different secret', async () => {
    const forged = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user_1')
      .setIssuer('pocketbudz')
      .setExpirationTime('5m')
      .sign(new TextEncoder().encode('some-other-secret-some-other-secret-1234'));
    expect(await verifyAccessToken(forged)).toBeNull();
  });

  it('rejects an expired token', async () => {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const expired = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user_1')
      .setIssuer('pocketbudz')
      .setIssuedAt(Math.floor(Date.now() / 1000) - 120)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(secret);
    expect(await verifyAccessToken(expired)).toBeNull();
  });
});

describe('refresh tokens', () => {
  it('generates unique tokens whose hash matches', () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a.token).not.toBe(b.token);
    expect(hashRefreshToken(a.token)).toBe(a.hash);
    expect(a.hash).not.toBe(a.token);
  });
});
