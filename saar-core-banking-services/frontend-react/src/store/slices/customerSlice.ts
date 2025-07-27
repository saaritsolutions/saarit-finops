import { createSlice } from '@reduxjs/toolkit';

// Placeholder slice for customer management
// This will be expanded when building the customer module
const customerSlice = createSlice({
  name: 'customers',
  initialState: {
    customers: [],
    loading: false,
    error: null,
  },
  reducers: {
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    setError: (state, action) => {
      state.error = action.payload;
    },
  },
});

export const { setLoading, setError } = customerSlice.actions;
export default customerSlice.reducer;
