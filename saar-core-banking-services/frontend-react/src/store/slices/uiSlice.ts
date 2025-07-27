import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// UI state interface
interface UIState {
  theme: 'light' | 'dark';
  sidebarOpen: boolean;
  loading: boolean;
  notifications: UINotification[];
  selectedModule: string | null;
  breadcrumbs: Breadcrumb[];
}

interface UINotification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  autoHide?: boolean;
}

interface Breadcrumb {
  label: string;
  path?: string;
  icon?: string;
}

// Initial state
const initialState: UIState = {
  theme: 'light',
  sidebarOpen: true,
  loading: false,
  notifications: [],
  selectedModule: null,
  breadcrumbs: [],
};

// UI slice
const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setTheme: (state, action: PayloadAction<'light' | 'dark'>) => {
      state.theme = action.payload;
    },
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setSidebarOpen: (state, action: PayloadAction<boolean>) => {
      state.sidebarOpen = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    addNotification: (state, action: PayloadAction<Omit<UINotification, 'id' | 'timestamp' | 'read'>>) => {
      const notification: UINotification = {
        ...action.payload,
        id: Date.now().toString(),
        timestamp: new Date(),
        read: false,
      };
      state.notifications.unshift(notification);
    },
    markNotificationAsRead: (state, action: PayloadAction<string>) => {
      const notification = state.notifications.find(n => n.id === action.payload);
      if (notification) {
        notification.read = true;
      }
    },
    removeNotification: (state, action: PayloadAction<string>) => {
      state.notifications = state.notifications.filter(n => n.id !== action.payload);
    },
    clearAllNotifications: (state) => {
      state.notifications = [];
    },
    setSelectedModule: (state, action: PayloadAction<string | null>) => {
      state.selectedModule = action.payload;
    },
    setBreadcrumbs: (state, action: PayloadAction<Breadcrumb[]>) => {
      state.breadcrumbs = action.payload;
    },
  },
});

// Action creators
export const {
  setTheme,
  toggleSidebar,
  setSidebarOpen,
  setLoading,
  addNotification,
  markNotificationAsRead,
  removeNotification,
  clearAllNotifications,
  setSelectedModule,
  setBreadcrumbs,
} = uiSlice.actions;

// Selectors
export const selectUI = (state: { ui: UIState }) => state.ui;
export const selectTheme = (state: { ui: UIState }) => state.ui.theme;
export const selectSidebarOpen = (state: { ui: UIState }) => state.ui.sidebarOpen;
export const selectLoading = (state: { ui: UIState }) => state.ui.loading;
export const selectNotifications = (state: { ui: UIState }) => state.ui.notifications;
export const selectUnreadNotifications = (state: { ui: UIState }) => 
  state.ui.notifications.filter(n => !n.read);
export const selectSelectedModule = (state: { ui: UIState }) => state.ui.selectedModule;
export const selectBreadcrumbs = (state: { ui: UIState }) => state.ui.breadcrumbs;

export default uiSlice.reducer;
