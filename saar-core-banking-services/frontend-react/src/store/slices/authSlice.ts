import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { User, UserStatus } from '../../types';

// Authentication state interface
interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  permissions: string[];
  sessionExpiry: Date | null;
}

// Initial state
const initialState: AuthState = {
  user: null,
  token: localStorage.getItem('auth-token'),
  isAuthenticated: false,
  isLoading: false,
  error: null,
  permissions: [],
  sessionExpiry: null,
};

// Async thunks for authentication
export const loginUser = createAsyncThunk(
  'auth/loginUser',
  async (credentials: { username: string; password: string }, { rejectWithValue }) => {
    try {
      // Mock authentication for development
      const mockUser: User = {
        id: '1',
        userId: 'admin001',
        username: credentials.username,
        firstName: 'Admin',
        lastName: 'User',
        email: credentials.username,
        roles: [{
          id: 'admin-role',
          name: 'Administrator',
          description: 'Full system access',
          permissions: []
        }],
        permissions: [],
        status: 'active' as UserStatus,
        lastLoginAt: new Date(),
        department: 'IT',
        branch: 'Head Office',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockPermissions = [
        'dashboard.view',
        'customers.view',
        'customers.create',
        'customers.edit',
        'accounts.view',
        'accounts.create',
        'accounts.edit',
        'transactions.view',
        'transactions.create',
        'loans.view',
        'loans.create',
        'loans.approve',
        'reports.view',
        'admin.users',
        'admin.settings',
      ];

      // Validate demo credentials
      if (credentials.username === 'admin@saarbanking.com' && credentials.password === 'admin123') {
        const mockToken = 'mock-jwt-token-' + Date.now();
        
        // Store token in localStorage
        localStorage.setItem('auth-token', mockToken);
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        return {
          user: mockUser,
          token: mockToken,
          permissions: mockPermissions,
          sessionExpiry: new Date(Date.now() + 8 * 60 * 60 * 1000), // 8 hours
        };
      } else {
        throw new Error('Invalid credentials');
      }
    } catch (error: any) {
      return rejectWithValue(error.message || 'Login failed');
    }
  }
);

export const logoutUser = createAsyncThunk(
  'auth/logoutUser',
  async (_, { rejectWithValue }) => {
    try {
      // Mock logout for development - just clear local data
      localStorage.removeItem('auth-token');
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return null;
    } catch (error: any) {
      // Even if logout fails, clear local data
      localStorage.removeItem('auth-token');
      return rejectWithValue(error.message || 'Logout failed');
    }
  }
);

export const refreshToken = createAsyncThunk(
  'auth/refreshToken',
  async (_, { rejectWithValue }) => {
    try {
      // Mock token refresh for development
      const currentToken = localStorage.getItem('auth-token');
      if (!currentToken) {
        throw new Error('No token to refresh');
      }
      
      const newToken = 'mock-jwt-token-' + Date.now();
      localStorage.setItem('auth-token', newToken);
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return {
        token: newToken,
        sessionExpiry: new Date(Date.now() + 8 * 60 * 60 * 1000), // 8 hours
      };
    } catch (error: any) {
      localStorage.removeItem('auth-token');
      return rejectWithValue(error.message || 'Token refresh failed');
    }
  }
);

export const getCurrentUser = createAsyncThunk(
  'auth/getCurrentUser',
  async (_, { rejectWithValue }) => {
    try {
      // Mock get current user for development
      const token = localStorage.getItem('auth-token');
      if (!token) {
        throw new Error('No authentication token');
      }
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const mockUser: User = {
        id: '1',
        userId: 'admin001',
        username: 'admin@saarbanking.com',
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@saarbanking.com',
        roles: [{
          id: 'admin-role',
          name: 'Administrator',
          description: 'Full system access',
          permissions: []
        }],
        permissions: [],
        status: 'active' as UserStatus,
        lastLoginAt: new Date(),
        department: 'IT',
        branch: 'Head Office',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockPermissions = [
        'dashboard.view',
        'customers.view',
        'customers.create',
        'customers.edit',
        'accounts.view',
        'accounts.create',
        'accounts.edit',
        'transactions.view',
        'transactions.create',
        'loans.view',
        'loans.create',
        'loans.approve',
        'reports.view',
        'admin.users',
        'admin.settings',
      ];

      return {
        user: mockUser,
        permissions: mockPermissions,
      };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to get user info');
    }
  }
);

// Auth slice
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    updateUserProfile: (state, action: PayloadAction<Partial<User>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
      }
    },
    checkSessionExpiry: (state) => {
      if (state.sessionExpiry && new Date() > state.sessionExpiry) {
        // Session expired
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        state.permissions = [];
        state.sessionExpiry = null;
        localStorage.removeItem('auth-token');
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Login cases
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.permissions = action.payload.permissions;
        state.sessionExpiry = action.payload.sessionExpiry;
        state.error = null;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.isAuthenticated = false;
      })
      
      // Logout cases
      .addCase(logoutUser.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.isLoading = false;
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        state.permissions = [];
        state.sessionExpiry = null;
        state.error = null;
      })
      .addCase(logoutUser.rejected, (state, action) => {
        state.isLoading = false;
        // Still clear auth data even if logout request failed
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        state.permissions = [];
        state.sessionExpiry = null;
      })
      
      // Refresh token cases
      .addCase(refreshToken.fulfilled, (state, action) => {
        state.token = action.payload.token;
        state.sessionExpiry = action.payload.sessionExpiry;
      })
      .addCase(refreshToken.rejected, (state) => {
        // Token refresh failed, clear auth
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        state.permissions = [];
        state.sessionExpiry = null;
      })
      
      // Get current user cases
      .addCase(getCurrentUser.fulfilled, (state, action) => {
        state.user = action.payload.user;
        state.permissions = action.payload.permissions;
        state.isAuthenticated = true;
      })
      .addCase(getCurrentUser.rejected, (state) => {
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        state.permissions = [];
        localStorage.removeItem('auth-token');
      });
  },
});

// Action creators
export const { clearError, setLoading, updateUserProfile, checkSessionExpiry } = authSlice.actions;

// Selectors
export const selectAuth = (state: { auth: AuthState }) => state.auth;
export const selectUser = (state: { auth: AuthState }) => state.auth.user;
export const selectIsAuthenticated = (state: { auth: AuthState }) => state.auth.isAuthenticated;
export const selectAuthLoading = (state: { auth: AuthState }) => state.auth.isLoading;
export const selectAuthError = (state: { auth: AuthState }) => state.auth.error;
export const selectUserPermissions = (state: { auth: AuthState }) => state.auth.permissions;

// Permission checker
export const hasPermission = (permissions: string[], requiredPermission: string): boolean => {
  return permissions.includes(requiredPermission) || permissions.includes('*');
};

export default authSlice.reducer;
