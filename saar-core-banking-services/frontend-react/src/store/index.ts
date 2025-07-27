import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import { FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist';

// Import slices
import authSlice from './slices/authSlice';
import customerSlice from './slices/customerSlice';
import uiSlice from './slices/uiSlice';
import otherSlices from './slices/otherSlices';

// Root reducer
const rootReducer = combineReducers({
  auth: authSlice,
  customers: customerSlice,
  accounts: otherSlices.account,
  transactions: otherSlices.transaction,
  loans: otherSlices.loan,
  notifications: otherSlices.notification,
  ui: uiSlice,
  audit: otherSlices.audit,
});

// Persist configuration
const persistConfig = {
  key: 'saar-banking-root',
  version: 1,
  storage,
  // Only persist certain slices for security
  whitelist: ['auth', 'ui'], // Don't persist sensitive financial data
  blacklist: ['customers', 'accounts', 'transactions', 'loans'], // Security: Don't persist sensitive data
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

// Store configuration
export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
      // Enable development features
      immutableCheck: process.env.NODE_ENV === 'development',
      thunk: {
        extraArgument: {
          // Add extra services if needed
        },
      },
    }).concat([
      // Add custom middleware for banking-specific requirements
      // auditMiddleware, // For tracking all state changes
      // errorReportingMiddleware, // For error tracking and reporting
    ]),
  devTools: process.env.NODE_ENV === 'development',
  preloadedState: undefined,
});

export const persistor = persistStore(store);

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Banking-specific action types for audit trail
export const BANKING_ACTION_TYPES = {
  // Customer actions
  CUSTOMER_CREATED: 'customer/created',
  CUSTOMER_UPDATED: 'customer/updated',
  CUSTOMER_KYC_UPDATED: 'customer/kycUpdated',
  
  // Account actions
  ACCOUNT_CREATED: 'account/created',
  ACCOUNT_CLOSED: 'account/closed',
  ACCOUNT_FROZEN: 'account/frozen',
  
  // Transaction actions
  TRANSACTION_INITIATED: 'transaction/initiated',
  TRANSACTION_COMPLETED: 'transaction/completed',
  TRANSACTION_FAILED: 'transaction/failed',
  TRANSACTION_REVERSED: 'transaction/reversed',
  
  // Authentication actions
  USER_LOGIN: 'auth/login',
  USER_LOGOUT: 'auth/logout',
  SESSION_EXPIRED: 'auth/sessionExpired',
  
  // Audit actions
  AUDIT_LOG_CREATED: 'audit/logCreated',
  SUSPICIOUS_ACTIVITY: 'audit/suspiciousActivity',
} as const;

// Store utilities for banking
export const storeUtils = {
  // Clear sensitive data on logout
  clearSensitiveData: () => {
    return {
      type: 'CLEAR_SENSITIVE_DATA',
    };
  },
  
  // Reset store to initial state
  resetStore: () => {
    return {
      type: 'RESET_STORE',
    };
  },
};

export default store;
