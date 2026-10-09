import { OAuth2Client } from 'google-auth-library';
import { config } from '../config.js';

export interface GoogleIdentity {
  sub: string;
  email: string;
  name: string;
}

// Injected into the auth service so tests can swap in a fake.
export type GoogleVerifier = (idToken: string) => Promise<GoogleIdentity>;

export function createGoogleVerifier(clientId: string = config.GOOGLE_CLIENT_ID): GoogleVerifier {
  const client = new OAuth2Client(clientId);
  return async (idToken) => {
    const ticket = await client.verifyIdToken({ idToken, audience: clientId });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email || payload.email_verified !== true) {
      throw new Error('Google account has no verified email');
    }
    return { sub: payload.sub, email: payload.email, name: payload.name ?? payload.email };
  };
}
