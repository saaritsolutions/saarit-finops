# Version Integration Guide

This document explains how the version system is integrated into the React application.

## Overview

The version integration consists of several components that work together to display and manage application version information:

- **version.ts**: Core utility functions for version management
- **VersionDisplay.tsx**: Reusable component for displaying version info
- **AboutDialog.tsx**: Detailed application information dialog
- **Sidebar footer**: Shows current version
- **Header menu**: "About" option to view detailed version info

## Components

### 1. Version Utilities (`src/utils/version.ts`)

Core functions for retrieving version information:

```typescript
import { getAppVersion, getBuildTime } from '../utils/version';

const version = getAppVersion();     // Gets version from REACT_APP_VERSION
const buildTime = getBuildTime();    // Gets build time from REACT_APP_BUILD_TIME
```

### 2. Version Display Component (`src/components/VersionDisplay.tsx`)

Reusable component with multiple display variants:

```tsx
import VersionDisplay from '../components/VersionDisplay';

// Compact display
<VersionDisplay variant="compact" />

// With tooltip
<VersionDisplay variant="tooltip" />

// Show build time
<VersionDisplay showBuildTime={true} />
```

### 3. About Dialog (`src/components/dialogs/AboutDialog.tsx`)

Comprehensive application information dialog accessible from the user menu in the header.

## Environment Configuration

The version information is configured through environment variables:

```bash
# .env file
REACT_APP_VERSION=2.0.0
REACT_APP_BUILD_TIME=2024-09-07T10:00:00Z
```

## Scripts

### Package.json Scripts

The build scripts automatically inject version and build time:

```bash
npm start    # Injects version and current timestamp
npm run build # Injects version and current timestamp for production
```

### Version Management Script

Use the `version-management.sh` script for advanced version management:

```bash
# Update version and build time
./version-management.sh update

# Bump version types
./version-management.sh bump-patch   # 1.0.0 -> 1.0.1
./version-management.sh bump-minor   # 1.0.0 -> 1.1.0
./version-management.sh bump-major   # 1.0.0 -> 2.0.0

# Set specific version
./version-management.sh set 3.1.4

# Build with version update
./version-management.sh build

# Show current version
./version-management.sh show
```

## Integration Points

### 1. Sidebar Footer
- Shows current version with tooltip for build date
- Located at the bottom of the sidebar navigation

### 2. Header User Menu
- "About" menu item opens detailed version information
- Accessible from the user profile menu

### 3. Cache Management
- Version information is used for cache busting
- Helps ensure users get the latest application version

## Usage Examples

### Basic Version Display
```tsx
import { getAppVersion } from '../utils/version';

const MyComponent = () => {
  const version = getAppVersion();
  return <span>Version: {version}</span>;
};
```

### Advanced Version Info
```tsx
import VersionDisplay from '../components/VersionDisplay';

const Footer = () => (
  <footer>
    <VersionDisplay 
      variant="tooltip" 
      showBuildTime={true} 
      size="small" 
    />
  </footer>
);
```

### Cache Busting
```tsx
import { addCacheBustToUrl } from '../utils/version';

const apiUrl = addCacheBustToUrl('/api/data');
// Result: /api/data?v=2.0.0&t=1704673200000
```

## CI/CD Integration

For automated deployments, integrate the version management script:

```bash
# In your CI/CD pipeline
cd frontend-react
./version-management.sh bump-patch
./version-management.sh build
```

## Development Workflow

1. **During Development**: Version is automatically read from package.json
2. **Before Release**: Use version management script to bump version
3. **Build Process**: Scripts automatically inject current timestamp
4. **Deployment**: Version info is available throughout the application

## Best Practices

1. **Always use the utility functions** instead of hardcoding versions
2. **Update package.json version** when making releases
3. **Use the version management script** for consistent version handling
4. **Test version display** in both development and production builds
5. **Include version info in bug reports** by making it easily accessible

## Troubleshooting

### Version not updating
- Check that REACT_APP_VERSION is set in .env
- Restart development server after changing .env
- Verify package.json version is correct

### Build time not showing
- Ensure REACT_APP_BUILD_TIME is set during build
- Check that environment variables are properly injected

### Component not displaying
- Verify imports are correct
- Check that Material-UI components are available
- Ensure proper component hierarchy
