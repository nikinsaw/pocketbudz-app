import { configureStore, combineReducers } from '@reduxjs/toolkit';
import secureStorage from '../storage/secureStorage';
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist';

import settingsReducer from './slices/settingsSlice';
import budgetReducer from './slices/budgetSlice';
import transactionsReducer from './slices/transactionsSlice';
import insightsReducer from './slices/insightsSlice';

const rootReducer = combineReducers({
  settings: settingsReducer,
  budget: budgetReducer,
  transactions: transactionsReducer,
  insights: insightsReducer,
});

// Bump this whenever a persisted slice's shape changes (renamed/removed
// field, restructured object, etc.). Pre-launch there's no real user data
// to preserve, so a version mismatch just discards the stale persisted
// state rather than rehydrating a shape the reducers no longer expect —
// which is what caused "cannot read property length of undefined" when
// insights.totalSaved.months became .series.
const PERSIST_VERSION = 4;

const persistConfig = {
  key: 'pocketbudz-root',
  version: PERSIST_VERSION,
  storage: secureStorage,
  migrate: (state) => {
    if (state && state._persist && state._persist.version === PERSIST_VERSION) {
      return Promise.resolve(state);
    }
    return Promise.resolve(undefined);
  },
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export const persistor = persistStore(store);
