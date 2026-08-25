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

const persistConfig = {
  key: 'pocketbudz-root',
  storage: secureStorage,
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
