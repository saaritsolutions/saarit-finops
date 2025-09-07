# Dynamic Version Management

This document explains how version management works in the React frontend application.

## How It Works

The application now uses **dynamic versioning** that automatically pulls the version from `package.json` instead of hardcoded values.

### Version Sources

1. **Primary**: `package.json` version field
2. **Injection**: Environment variables set during build/start
3. **Fallback**: Default values if environment variables are missing

### Build Process

The npm scripts automatically inject version information:

```bash
# Start command injects:
REACT_APP_VERSION=$npm_package_version          # From package.json
REACT_APP_BUILD_TIME=$(date +%s)               # Current Unix timestamp

# Build command injects the same variables
```

### Version Display

The version is displayed in multiple places:
- **Sidebar Footer**: Shows current version with tooltip
- **About Dialog**: Shows detailed version info including build time
- **Header Menu**: Access to About dialog via "About" menu item

## Version Management Commands

### Update Version

```bash
# Increment patch version (2.0.0 → 2.0.1)
npm run version-patch

# Increment minor version (2.0.0 → 2.1.0)
npm run version-minor

# Increment major version (2.0.0 → 3.0.0)
npm run version-major

# Using npm's built-in command
npm run version-bump
```

### View Current Version

```bash
# In the application
- Check sidebar footer
- Click "About" in header menu

# In terminal
node -p "require('./package.json').version"
```

## Files Involved

- `package.json` - Source of truth for version
- `src/utils/version.ts` - Version utilities and fallbacks
- `src/components/VersionDisplay.tsx` - Version display component
- `src/components/dialogs/AboutDialog.tsx` - Detailed version dialog
- `scripts/update-version.js` - Version increment script
- `.env` - No longer contains hardcoded version values

## Environment Variables

### Development
- `REACT_APP_VERSION` - Injected from package.json during start
- `REACT_APP_BUILD_TIME` - Unix timestamp of build/start time

### Production
- Same variables injected during build process
- Build time represents actual deployment time

## Benefits

1. **Single Source of Truth**: Version is managed only in package.json
2. **Automatic Injection**: No manual updates needed
3. **Build-time Accuracy**: Build time reflects actual compile time
4. **Development Friendly**: Works in both dev and production modes
5. **Cache Busting**: Dynamic build time helps with cache invalidation

## Troubleshooting

### Version Not Showing
- Check if environment variables are being injected
- Verify npm scripts are running correctly
- Check browser dev tools for environment variables

### Build Time Issues
- Unix timestamps are automatically converted to ISO strings
- Fallback to current time if build time is missing

### Development vs Production
- Development: Uses current timestamp for build time
- Production: Uses actual build timestamp
