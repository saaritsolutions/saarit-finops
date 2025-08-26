#!/bin/bash

# 🚀 Demo Launcher - Complete Demo Environment Setup
# One-click setup for the investor demo

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

echo "🚀 ==============================================="
echo "   SaaR Banking Demo - Complete Setup"
echo "==============================================="
echo ""

log_info "Starting complete demo environment..."
echo ""

# Step 1: Start all backend services
log_info "Step 1: Starting backend services..."
cd "$PROJECT_ROOT"

if [ -f "./scripts/start-all.sh" ]; then
    log_info "Launching all backend services..."
    bash ./scripts/start-all.sh &
    SERVICES_PID=$!
    
    # Wait for services to start
    log_info "Waiting for services to initialize..."
    sleep 15
else
    log_warning "start-all.sh not found, starting services individually..."
    
    # Start services individually
    log_info "Starting ExpressionBuilderService..."
    cd ExpressionBuilderService
    dotnet run --urls "http://localhost:5004" &
    
    cd ../WorkflowOrchestrationService
    log_info "Starting WorkflowOrchestrationService..."
    dotnet run --urls "http://localhost:5012" &
    
    cd ../DynamicFieldsSchemaService  
    log_info "Starting DynamicFieldsSchemaService..."
    dotnet run --urls "http://localhost:5013" &
    
    cd ../LoanService
    log_info "Starting LoanService..."
    dotnet run --urls "http://localhost:5130" &
    
    cd ..
    
    log_info "Waiting for services to initialize..."
    sleep 20
fi

# Step 2: Start frontend
log_info "Step 2: Starting frontend application..."
cd frontend-react

if [ -f "./start-dev.sh" ]; then
    log_info "Launching frontend..."
    ./start-dev.sh &
    FRONTEND_PID=$!
else
    log_info "Starting frontend with npm..."
    npm start &
    FRONTEND_PID=$!
fi

# Wait for frontend to start
log_info "Waiting for frontend to initialize..."
sleep 10

# Step 3: Run health checks
log_info "Step 3: Running health checks..."
cd "$PROJECT_ROOT"

if [ -f "./scripts/demo-test.sh" ]; then
    log_info "Running comprehensive demo tests..."
    bash ./scripts/demo-test.sh
else
    log_warning "Demo test script not found, running basic checks..."
    
    # Basic health checks
    log_info "Checking service health..."
    for port in 5004 5012 5013 5130 3001; do
        if curl -s "http://localhost:$port" > /dev/null 2>&1; then
            log_success "Service on port $port is running"
        else
            log_warning "Service on port $port is not responding"
        fi
    done
fi

# Step 4: Display demo information
echo ""
echo "🎭 ==============================================="
echo "   DEMO ENVIRONMENT READY!"
echo "==============================================="
echo ""
echo "🔗 Demo URLs:"
echo "   • Frontend:     http://localhost:3001"
echo "   • Login Page:   http://localhost:3001/login"
echo "   • Expressions:  http://localhost:3001/expressions"
echo "   • Loan App:     http://localhost:3001/loans/new"
echo "   • Admin:        http://localhost:3001/admin/config"
echo ""
echo "🔐 Demo Credentials:"
echo "   • Username:     admin@saarbanking.com"
echo "   • Password:     admin123"
echo ""
echo "📚 Demo Resources:"
echo "   • Story Scripts:     DEMO_STORY_SCRIPTS.md"
echo "   • Quick Reference:   DEMO_QUICK_REFERENCE.md"
echo "   • Test Results:      See output above"
echo ""
echo "🛠️ API Documentation:"
echo "   • LoanService:      http://localhost:5130/swagger"
echo "   • Expressions:      http://localhost:5004/swagger"
echo "   • Workflow:         http://localhost:5012/swagger"
echo "   • Dynamic Forms:    http://localhost:5013/swagger"
echo ""

# Step 5: Optional simulation run
echo "🧪 Would you like to run the demo simulation? (y/n)"
read -r response
if [[ "$response" =~ ^[Yy]$ ]]; then
    log_info "Running demo simulation..."
    bash ./scripts/demo-simulation.sh
fi

echo ""
log_success "Demo environment is ready for the investor presentation!"
echo ""
echo "💡 Pro Tips:"
echo "   • Keep this terminal open (services are running in background)"
echo "   • Open browser to http://localhost:3001/login to start"
echo "   • Use Ctrl+C to stop all services when done"
echo ""
echo "🎬 Break a leg with your demo!"

# Keep script running to maintain services
wait
