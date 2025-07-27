import { createSlice } from '@reduxjs/toolkit';

// Placeholder slices for other banking modules
// These will be expanded as needed

export const accountSlice = createSlice({
  name: 'accounts',
  initialState: { accounts: [], loading: false, error: null },
  reducers: {
    setLoading: (state, action) => { state.loading = action.payload; },
    setError: (state, action) => { state.error = action.payload; },
  },
});

export const transactionSlice = createSlice({
  name: 'transactions',
  initialState: { transactions: [], loading: false, error: null },
  reducers: {
    setLoading: (state, action) => { state.loading = action.payload; },
    setError: (state, action) => { state.error = action.payload; },
  },
});

export const loanSlice = createSlice({
  name: 'loans',
  initialState: { loans: [], loading: false, error: null },
  reducers: {
    setLoading: (state, action) => { state.loading = action.payload; },
    setError: (state, action) => { state.error = action.payload; },
  },
});

export const notificationSlice = createSlice({
  name: 'notifications',
  initialState: { notifications: [], loading: false, error: null },
  reducers: {
    setLoading: (state, action) => { state.loading = action.payload; },
    setError: (state, action) => { state.error = action.payload; },
  },
});

export const auditSlice = createSlice({
  name: 'audit',
  initialState: { logs: [], loading: false, error: null },
  reducers: {
    setLoading: (state, action) => { state.loading = action.payload; },
    setError: (state, action) => { state.error = action.payload; },
  },
});

// Export reducers
export default {
  account: accountSlice.reducer,
  transaction: transactionSlice.reducer,
  loan: loanSlice.reducer,
  notification: notificationSlice.reducer,
  audit: auditSlice.reducer,
};
