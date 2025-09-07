#!/bin/bash

# Fast React Development Server Startup Script
# This script ensures we're in the right directory and starts the React app

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR"

echo "🚀 Starting React Development Server..."
echo "📁 Working directory: $(pwd)"
echo "📊 Memory limit: 4GB"
echo "⚡ TypeScript checking: Disabled"
echo "🔧 ESLint: Disabled"
echo "📈 Source maps: Disabled"
echo ""

# Kill any existing processes
echo "🧹 Cleaning up existing processes..."
pkill -f "node.*craco\|node.*react-scripts" 2>/dev/null || true
sleep 2

# Clear cache
echo "🗑️  Clearing cache..."
rm -rf node_modules/.cache .tsbuildinfo 2>/dev/null || true

# Set environment variables
export PORT=3002
export BROWSER=none
export SKIP_PREFLIGHT_CHECK=true
export TSC_COMPILE_ON_ERROR=true
export DISABLE_ESLINT_PLUGIN=true
export GENERATE_SOURCEMAP=false
export NODE_OPTIONS="--max-old-space-size=4096"
export REACT_APP_VERSION=$(node -p "require('./package.json').version")
export REACT_APP_BUILD_TIME=$(date +%s)
export CRACO_CONFIG_FILE="./craco.config.simple.js"

echo "🎯 Starting development server on port 3002..."
echo "🌐 Open http://localhost:3002 in your browser"
echo ""

# Start the development server
npx craco start
