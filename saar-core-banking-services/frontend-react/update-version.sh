#!/bin/bash

# Update build time in .env file
BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
VERSION=$(node -p "require('./package.json').version")

# Update .env file with current build time and version
sed -i.bak "s/REACT_APP_VERSION=.*/REACT_APP_VERSION=$VERSION/" .env
sed -i.bak "s/REACT_APP_BUILD_TIME=.*/REACT_APP_BUILD_TIME=$BUILD_TIME/" .env

echo "Updated version to $VERSION and build time to $BUILD_TIME"

# Remove backup file
rm -f .env.bak
