/**
 * Intelligent cache management with version detection
 */

import { getAppVersion, getBuildTime, clearApplicationCache } from './version';

const CACHE_VERSION_KEY = 'app-cache-version';
const CACHE_BUILD_TIME_KEY = 'app-cache-build-time';

export const shouldClearCache = (): boolean => {
  const currentVersion = getAppVersion();
  const currentBuildTime = getBuildTime();
  
  const cachedVersion = localStorage.getItem(CACHE_VERSION_KEY);
  const cachedBuildTime = localStorage.getItem(CACHE_BUILD_TIME_KEY);
  
  // Clear cache if version or build time has changed
  return (
    cachedVersion !== currentVersion || 
    cachedBuildTime !== currentBuildTime
  );
};

export const updateCacheVersion = (): void => {
  const currentVersion = getAppVersion();
  const currentBuildTime = getBuildTime();
  
  localStorage.setItem(CACHE_VERSION_KEY, currentVersion);
  localStorage.setItem(CACHE_BUILD_TIME_KEY, currentBuildTime);
};

export const clearAllCaches = async (): Promise<void> => {
  try {
    // Clear application cache
    clearApplicationCache();
    
    // Clear service worker cache
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations.map(registration => registration.unregister())
      );
    }
    
    // Clear browser caches
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      );
    }
    
    console.log('All caches cleared successfully');
  } catch (error) {
    console.warn('Failed to clear some caches:', error);
  }
};

export const initializeCacheManager = (): void => {
  // Check if cache should be cleared on app startup
  if (shouldClearCache()) {
    console.log('Version change detected, clearing caches...');
    clearAllCaches().then(() => {
      updateCacheVersion();
    });
  } else {
    console.log('No version change detected, keeping existing cache');
  }
  
  // Always update cache version info
  updateCacheVersion();
};
