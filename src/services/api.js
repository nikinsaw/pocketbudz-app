import { API_BASE_URL, GOOGLE_WEB_CLIENT_ID } from '@env';
import {
  GoogleSignin,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { sessionStore } from '../storage/sessionStore';
import { createApiClient } from './apiClient';
import { createGoogleAuth } from './googleAuth';

// App-wide instances. Everything that talks to the household backend goes
// through `api`, so there is exactly one token cache and one refresh at a time.
export const api = createApiClient({ baseUrl: API_BASE_URL, store: sessionStore });

export const googleAuth = createGoogleAuth({
  google: GoogleSignin,
  statusCodes,
  isErrorWithCode,
  webClientId: GOOGLE_WEB_CLIENT_ID,
  api,
});
