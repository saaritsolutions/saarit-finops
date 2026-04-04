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

// Get stored token and check if it's valid (or auto-authenticate in development)
const storedToken = localStorage.getItem('auth-token');
const isDevelopment = process.env.NODE_ENV === 'development';
// Accept real JWTs (3 dot-separated base64 segments) as well as legacy mock tokens
const isRealJwt   = Boolean(storedToken && storedToken.split('.').length === 3);
const isMockToken = Boolean(storedToken && storedToken.startsWith('mock-jwt-token-'));
const isValidToken = isRealJwt || isMockToken || isDevelopment;

// ── Permission helpers ────────────────────────────────────────────────────────
const ALL_PERMISSIONS = [
  'dashboard.view',
  'customer.view', 'customer.create', 'customer.edit',
  'account.view', 'account.create', 'account.edit',
  'transaction.view', 'transaction.create',
  'loan.view', 'loan.create', 'loan.approve',
  'reports.view',
  'user.management',
  'system.config',
  'admin.expressions',
];

function resolveTenantName(tenantId?: string): string {
  if (tenantId === 'ucb_demo')  return 'UCB Cooperative Bank';
  if (tenantId === 'nbfc_demo') return 'SaaR NBFC';
  return 'SaaR Core Banking';
}

function buildPermissionsFromRoles(roles: string[]): string[] {
  if (roles.includes('Admin')) return ALL_PERMISSIONS;
  if (roles.includes('Maker')) return [
    'dashboard.view',
    'customer.view', 'customer.create', 'customer.edit',
    'account.view', 'account.create',
    'transaction.view', 'transaction.create',
    'loan.view', 'loan.create',
  ];
  if (roles.includes('Checker')) return [
    'dashboard.view',
    'customer.view',
    'account.view', 'account.edit',
    'transaction.view',
    'loan.view', 'loan.approve',
  ];
  return ['dashboard.view'];
}

// Initial state
const initialState: AuthState = {
  user: isValidToken ? {
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
    status: 'active' as any,
    lastLoginAt: new Date(),
    department: 'IT',
    branch: 'Head Office',
    createdAt: new Date(),
    updatedAt: new Date(),
  } : null,
  token: storedToken || (isDevelopment ? 'mock-jwt-token-dev' : null),
  isAuthenticated: isValidToken,
  isLoading: false,
  error: null,
  permissions: isValidToken ? [
    'dashboard.view',
    'customer.view',
    'customer.create',
    'customer.edit',
    'account.view',
    'account.create',
    'account.edit',
    'transaction.view',
    'transaction.create',
    'loan.view',
    'loan.create',
    'loan.approve',
    'reports.view',
    'user.management',
    'system.config',
    'admin.expressions',
  ] : [],
  sessionExpiry: isValidToken ? new Date(Date.now() + 8 * 60 * 60 * 1000) : null,
};

// Async thunks for authentication
export const loginUser = createAsyncThunk(
  'auth/loginUser',
  async (credentials: { username: string; password: string }, { rejectWithValue }) => {
    const apiBase = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5004';

    try {
      // ── Attempt real backend login ─────────────────────────────────────────
      const response = await fetch(`${apiBase}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: credentials.username, password: credentials.password }),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('auth-token', data.token);
        const roleNames: string[] = data.user?.roles ?? ['Admin'];
        const permissions = buildPermissionsFromRoles(roleNames);

        const tenantId   = data.user.tenantId ?? 'public';
        const tenantName = resolveTenantName(tenantId);
        return {
          user: {
            id:          data.user.id,
            userId:      data.user.userId,
            username:    data.user.username,
            email:       data.user.email,
            firstName:   data.user.firstName,
            lastName:    data.user.lastName,
            roles:       roleNames.map((r: string) => ({
              id: r.toLowerCase(), name: r, description: `${r} role`, permissions: [],
            })),
            permissions: [],
            status:      'active' as UserStatus,
            lastLoginAt: new Date(),
            department:  'Banking Operations',
            branch:      'Head Office',
            createdAt:   new Date(),
            updatedAt:   new Date(),
            tenantId,
            tenantName,
          } as User,
          token:         data.token,
          permissions,
          sessionExpiry: new Date(Date.now() + 8 * 60 * 60 * 1000),
        };
      }

      // Backend returned an error response (e.g. 401 Invalid credentials)
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody?.message || 'Invalid credentials');

    } catch (error: any) {
      // ── Mock fallback: only for network errors (backend not reachable in local dev) ──
      if (error instanceof TypeError) {
        if (
          credentials.username === 'admin@saarbanking.com'   && credentials.password === 'admin123' ||
          credentials.username === 'maker@saarbanking.com'   && credentials.password === 'maker123' ||
          credentials.username === 'checker@saarbanking.com' && credentials.password === 'checker123'
        ) {
          const role  = credentials.username.split('@')[0];
          const roles = [role.charAt(0).toUpperCase() + role.slice(1)];
          const mockToken = 'mock-jwt-token-' + Date.now();
          localStorage.setItem('auth-token', mockToken);
          await new Promise(resolve => setTimeout(resolve, 600));
          return {
            user: {
              id: '1', userId: 'admin001',
              username:  credentials.username,
              email:     credentials.username,
              firstName: role.charAt(0).toUpperCase() + role.slice(1),
              lastName:  'User',
              roles:     roles.map(r => ({ id: r.toLowerCase(), name: r, description: `${r} role`, permissions: [] })),
              permissions: [],
              status: 'active' as UserStatus,
              lastLoginAt: new Date(), department: 'IT', branch: 'Head Office',
              createdAt: new Date(), updatedAt: new Date(),
            } as User,
            token:         mockToken,
            permissions:   buildPermissionsFromRoles(roles),
            sessionExpiry: new Date(Date.now() + 8 * 60 * 60 * 1000),
          };
        }
        return rejectWithValue('Invalid credentials');
      }

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
        'customer.view',
        'customer.create',
        'customer.edit',
        'account.view',
        'account.create',
        'account.edit',
        'transaction.view',
        'transaction.create',
        'loan.view',
        'loan.create',
        'loan.approve',
        'reports.view',
        'user.management',
        'system.config',
        'admin.expressions',
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
