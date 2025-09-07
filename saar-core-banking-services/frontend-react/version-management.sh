#!/bin/bash

# Version Management Script for React App
# Usage: ./version-management.sh [command] [version]
# Commands: update, build, bump-patch, bump-minor, bump-major

set -e

FRONTEND_DIR="/Users/apple/GithubRepos/saarit-finops/saar-core-banking-services/frontend-react"
ENV_FILE="$FRONTEND_DIR/.env"
PACKAGE_FILE="$FRONTEND_DIR/package.json"

cd "$FRONTEND_DIR"

# Function to update build time in .env
update_build_time() {
    local build_time=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    echo "Updating build time to: $build_time"
    
    # Update or add REACT_APP_BUILD_TIME in .env
    if grep -q "REACT_APP_BUILD_TIME=" "$ENV_FILE"; then
        sed -i.bak "s/REACT_APP_BUILD_TIME=.*/REACT_APP_BUILD_TIME=$build_time/" "$ENV_FILE"
    else
        echo "REACT_APP_BUILD_TIME=$build_time" >> "$ENV_FILE"
    fi
    
    # Clean up backup file
    rm -f "$ENV_FILE.bak"
}

# Function to update version in .env from package.json
update_version_in_env() {
    local version=$(node -p "require('./package.json').version")
    echo "Updating version in .env to: $version"
    
    # Update or add REACT_APP_VERSION in .env
    if grep -q "REACT_APP_VERSION=" "$ENV_FILE"; then
        sed -i.bak "s/REACT_APP_VERSION=.*/REACT_APP_VERSION=$version/" "$ENV_FILE"
    else
        echo "REACT_APP_VERSION=$version" >> "$ENV_FILE"
    fi
    
    # Clean up backup file
    rm -f "$ENV_FILE.bak"
}

# Function to get current version
get_version() {
    node -p "require('./package.json').version"
}

# Main command handling
case "${1:-update}" in
    "update")
        echo "Updating version and build time..."
        update_version_in_env
        update_build_time
        echo "Version management completed!"
        ;;
    
    "build")
        echo "Preparing for build..."
        update_version_in_env
        update_build_time
        echo "Running build..."
        npm run build
        echo "Build completed!"
        ;;
    
    "bump-patch")
        echo "Bumping patch version..."
        npm version patch --no-git-tag-version
        update_version_in_env
        update_build_time
        echo "Patch version bumped to: $(get_version)"
        ;;
    
    "bump-minor")
        echo "Bumping minor version..."
        npm version minor --no-git-tag-version
        update_version_in_env
        update_build_time
        echo "Minor version bumped to: $(get_version)"
        ;;
    
    "bump-major")
        echo "Bumping major version..."
        npm version major --no-git-tag-version
        update_version_in_env
        update_build_time
        echo "Major version bumped to: $(get_version)"
        ;;
    
    "set")
        if [ -z "$2" ]; then
            echo "Error: Please provide a version number"
            echo "Usage: $0 set 1.2.3"
            exit 1
        fi
        echo "Setting version to: $2"
        npm version "$2" --no-git-tag-version
        update_version_in_env
        update_build_time
        echo "Version set to: $(get_version)"
        ;;
    
    "show")
        echo "Current version: $(get_version)"
        echo "Current build time: $(grep REACT_APP_BUILD_TIME= "$ENV_FILE" | cut -d= -f2)"
        ;;
    
    *)
        echo "Usage: $0 [command] [version]"
        echo "Commands:"
        echo "  update       - Update version and build time from package.json"
        echo "  build        - Update version/build time and run build"
        echo "  bump-patch   - Bump patch version (x.x.X)"
        echo "  bump-minor   - Bump minor version (x.X.x)"
        echo "  bump-major   - Bump major version (X.x.x)"
        echo "  set [version] - Set specific version"
        echo "  show         - Show current version and build time"
        exit 1
        ;;
esac
