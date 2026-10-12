import { api, googleAuth } from './api';
import { createHouseholdActions } from './householdActions';

// The app's household actions, bound to the real API client and Google sign-in.
export const householdActions = createHouseholdActions({ api, googleAuth });
