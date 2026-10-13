import { api, googleAuth } from './api';
import { createDataActions } from './dataActions';
import { createHouseholdActions } from './householdActions';

// The app's household actions, bound to the real API client and Google sign-in.
export const householdActions = createHouseholdActions({ api, googleAuth });

// Mode-aware data changes (add/edit/delete transactions and envelopes, set income): the
// screens call these instead of dispatching the solo slice actions directly.
export const dataActions = createDataActions({ api });
