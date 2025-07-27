import React, { useEffect } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { Provider, useDispatch } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ErrorBoundary } from 'react-error-boundary';

// Store and theme
import { store, persistor } from './store';
import { CustomThemeProvider } from './theme/ThemeProvider';
import { getCurrentUser } from './store/slices/authSlice';

// Router
import { AppRouter } from './router/AppRouter';

// Components
import ErrorFallback from './components/common/ErrorFallback';
import LoadingSpinner from './components/common/LoadingSpinner';

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
});

/**
 * App initialization component - handles auth token check
 */
const AppInitializer: React.FC = () => {
  const dispatch = useDispatch();

  useEffect(() => {
    // Check if user has a valid token on app start
    const token = localStorage.getItem('auth-token');
    if (token) {
      dispatch(getCurrentUser() as any);
    }
  }, [dispatch]);

  return <AppRouter />;
};

/**
 * Main App component with all providers
 * - Redux store with persistence
 * - React Query for server state
 * - Material-UI theming
 * - React Router for navigation
 * - Error boundaries for error handling
 */
function App() {
  useEffect(() => {
    // Set up global error handling
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason);
      // You can add error reporting here
    };

    const handleError = (event: ErrorEvent) => {
      console.error('Global error:', event.error);
      // You can add error reporting here
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error, errorInfo) => {
        console.error('Error caught by boundary:', error, errorInfo);
        // Add error reporting service here
      }}
    >
      <Provider store={store}>
        <PersistGate loading={<LoadingSpinner />} persistor={persistor}>
          <QueryClientProvider client={queryClient}>
            <CustomThemeProvider>
              <Router>
                <AppInitializer />
              </Router>
            </CustomThemeProvider>
            {/* React Query DevTools - only in development */}
            {process.env.NODE_ENV === 'development' && (
              <ReactQueryDevtools initialIsOpen={false} />
            )}
          </QueryClientProvider>
        </PersistGate>
      </Provider>
    </ErrorBoundary>
  );
}

export default App;
