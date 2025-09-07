/**
 * Version and cache management utilities
 */

// Get fallback version (will be replaced by environment variable in production)
const getPackageVersion = (): string => {
  // This fallback is used when environment variables are not available
  return '2.0.0'; // This matches the current package.json version
};

export const getAppVersion = (): string => {
  return process.env.REACT_APP_VERSION || getPackageVersion();
};

export const getBuildTime = (): string => {
  const buildTime = process.env.REACT_APP_BUILD_TIME;
  if (buildTime) {
    // If it's a Unix timestamp, convert to ISO string
    if (/^\d+$/.test(buildTime)) {
      return new Date(parseInt(buildTime) * 1000).toISOString();
    }
    return buildTime;
  }
  return new Date().toISOString();
};

export const generateCacheBustParam = (): string => {
  const version = getAppVersion();
  const buildTime = getBuildTime();
  return `v=${version}&t=${buildTime || Date.now()}`;
};

export const addCacheBustToUrl = (url: string): string => {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${generateCacheBustParam()}`;
};

export const forceReload = (): void => {
  // Clear various caches
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      registrations.forEach(registration => registration.unregister());
    });
  }

  // Clear browser cache for this origin
  if ('caches' in window) {
    caches.keys().then(names => {
      names.forEach(name => caches.delete(name));
    });
  }

  // Clear session storage (but preserve auth data)
  const authToken = localStorage.getItem('auth-token');
  const userPrefs = localStorage.getItem('user-preferences');
  
  // Clear all storage
  localStorage.clear();
  sessionStorage.clear();
  
  // Restore important data
  if (authToken) localStorage.setItem('auth-token', authToken);
  if (userPrefs) localStorage.setItem('user-preferences', userPrefs);

  // Force reload with cache bypass
  window.location.reload();
};

export const clearApplicationCache = (): void => {
  // Clear React Query cache
  const queryClient = (window as any).queryClient;
  if (queryClient) {
    queryClient.clear();
  }

  // Clear other application caches
  if ('caches' in window) {
    caches.keys().then(names => {
      names.forEach(name => {
        if (name.includes('workbox') || name.includes('precache')) {
          caches.delete(name);
        }
      });
    });
  }
};
