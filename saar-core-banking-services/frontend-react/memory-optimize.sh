#!/bin/bash

# Memory Optimization Script for React Development
# Usage: ./memory-optimize.sh [command]
# Commands: check, clean, start-safe, monitor

set -e

FRONTEND_DIR="/Users/apple/GithubRepos/saarit-finops/saar-core-banking-services/frontend-react"
cd "$FRONTEND_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check current memory usage
check_memory() {
    log_info "Checking system memory usage..."
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        echo "Memory Usage:"
        vm_stat | grep -E "(free|inactive|wired|compressed)" | awk '{print $1 $2 $3}'
        echo ""
        echo "Available Memory:"
        top -l 1 -s 0 | grep PhysMem
    else
        # Linux
        free -h
    fi
    
    echo ""
    log_info "Node.js processes:"
    ps aux | grep -E "(node|npm|yarn)" | grep -v grep || echo "No Node.js processes running"
}

# Function to clean caches and temporary files
clean_caches() {
    log_info "Cleaning caches and temporary files..."
    
    # Remove node_modules and package-lock if they exist
    if [ -d "node_modules" ]; then
        log_warning "Removing node_modules..."
        rm -rf node_modules
    fi
    
    if [ -f "package-lock.json" ]; then
        log_warning "Removing package-lock.json..."
        rm -f package-lock.json
    fi
    
    # Clean npm cache
    log_info "Cleaning npm cache..."
    npm cache clean --force
    
    # Remove build artifacts
    if [ -d "build" ]; then
        log_info "Removing build directory..."
        rm -rf build
    fi
    
    # Remove TypeScript build info
    if [ -f ".tsbuildinfo" ]; then
        log_info "Removing TypeScript build info..."
        rm -f .tsbuildinfo
    fi
    
    # Remove webpack cache
    if [ -d "node_modules/.cache" ]; then
        log_info "Removing webpack cache..."
        rm -rf node_modules/.cache
    fi
    
    log_success "Cache cleanup completed!"
}

# Function to reinstall dependencies with memory optimizations
reinstall_deps() {
    log_info "Reinstalling dependencies with memory optimizations..."
    
    # Set npm configurations for better memory handling
    npm config set fund false
    npm config set audit false
    npm config set progress false
    
    # Install with specific flags for memory optimization
    log_info "Installing dependencies..."
    npm install --no-audit --no-fund --prefer-offline --legacy-peer-deps
    
    log_success "Dependencies reinstalled successfully!"
}

# Function to start development server with safe settings
start_safe() {
    log_info "Starting development server with memory-safe settings..."
    
    # Kill any existing Node processes
    pkill -f "node.*react-scripts\|node.*craco" || true
    sleep 2
    
    # Set memory limits and start
    export NODE_OPTIONS="--max-old-space-size=8192"
    export GENERATE_SOURCEMAP=false
    export FAST_REFRESH=false
    export TSC_COMPILE_ON_ERROR=true
    export DISABLE_ESLINT_PLUGIN=true
    
    log_info "Starting with NODE_OPTIONS: $NODE_OPTIONS"
    npm run start-fast
}

# Function to monitor memory usage during development
monitor_memory() {
    log_info "Starting memory monitor (Press Ctrl+C to stop)..."
    
    while true; do
        clear
        echo "=== Memory Monitor - $(date) ==="
        echo ""
        
        # System memory
        if [[ "$OSTYPE" == "darwin"* ]]; then
            top -l 1 -s 0 | grep PhysMem
        else
            free -h | grep Mem
        fi
        
        echo ""
        echo "Node.js Processes:"
        ps aux | grep -E "(node|npm|yarn)" | grep -v grep | awk '{printf "%-8s %-6s %-6s %s\n", $1, $2, $4, $11}' || echo "No Node.js processes"
        
        echo ""
        echo "Large directories in project:"
        du -sh node_modules build .cache 2>/dev/null | sort -hr || true
        
        sleep 5
    done
}

# Function to optimize TypeScript configuration
optimize_typescript() {
    log_info "Optimizing TypeScript configuration..."
    
    # Backup original tsconfig
    if [ -f "tsconfig.json" ] && [ ! -f "tsconfig.json.bak" ]; then
        cp tsconfig.json tsconfig.json.bak
        log_info "Backed up original tsconfig.json"
    fi
    
    log_success "TypeScript configuration optimized!"
}

# Function to show memory optimization tips
show_tips() {
    echo ""
    log_info "Memory Optimization Tips:"
    echo "1. Use 'npm run start-fast' for fastest development"
    echo "2. Use 'npm run start-no-ts' to disable TypeScript completely"
    echo "3. Close other memory-intensive applications"
    echo "4. Consider using smaller bundle sizes with code splitting"
    echo "5. Regularly clean caches with './memory-optimize.sh clean'"
    echo "6. Monitor memory usage with './memory-optimize.sh monitor'"
    echo ""
    echo "Available Commands:"
    echo "  check      - Check current memory usage"
    echo "  clean      - Clean all caches and temporary files"
    echo "  reinstall  - Clean and reinstall dependencies"
    echo "  start-safe - Start development server with safe settings"
    echo "  monitor    - Monitor memory usage in real-time"
    echo "  optimize   - Optimize TypeScript and build configurations"
    echo "  tips       - Show this help message"
}

# Main command handling
case "${1:-tips}" in
    "check")
        check_memory
        ;;
    
    "clean")
        clean_caches
        ;;
    
    "reinstall")
        clean_caches
        reinstall_deps
        ;;
    
    "start-safe")
        start_safe
        ;;
    
    "monitor")
        monitor_memory
        ;;
    
    "optimize")
        optimize_typescript
        ;;
    
    "full-reset")
        log_warning "Performing full reset (this will take time)..."
        clean_caches
        reinstall_deps
        optimize_typescript
        log_success "Full reset completed!"
        ;;
    
    "tips"|*)
        show_tips
        ;;
esac
