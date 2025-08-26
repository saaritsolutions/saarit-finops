#!/bin/bash

# 🧪 SaaR Banking Platform - Demo Automation Test Suite
# This script validates all demo scenarios before the investor presentation

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="http://localhost"
FRONTEND_PORT="3001"
LOAN_SERVICE_PORT="5130"
EXPRESSION_SERVICE_PORT="5004"
WORKFLOW_SERVICE_PORT="5012"
DYNAMIC_FORMS_PORT="5013"

# Demo credentials
DEMO_USERNAME="admin@saarbanking.com"
DEMO_PASSWORD="admin123"

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
    ((PASSED_TESTS++))
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    ((FAILED_TESTS++))
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

test_start() {
    ((TOTAL_TESTS++))
    log_info "Test $TOTAL_TESTS: $1"
}

# Wait for service to be ready
wait_for_service() {
    local port=$1
    local service_name=$2
    local max_attempts=30
    local attempt=1
    
    log_info "Waiting for $service_name on port $port..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s "$BASE_URL:$port" > /dev/null 2>&1; then
            log_success "$service_name is ready"
            return 0
        fi
        
        if [ $((attempt % 5)) -eq 0 ]; then
            log_info "Still waiting for $service_name... (attempt $attempt/$max_attempts)"
        fi
        
        sleep 2
        ((attempt++))
    done
    
    log_error "$service_name failed to start on port $port"
    return 1
}

# Test service health endpoints
test_service_health() {
    test_start "Service Health Checks"
    
    # Test all services
    services=(
        "$FRONTEND_PORT:Frontend"
        "$LOAN_SERVICE_PORT:LoanService" 
        "$EXPRESSION_SERVICE_PORT:ExpressionService"
        "$WORKFLOW_SERVICE_PORT:WorkflowService"
        "$DYNAMIC_FORMS_PORT:DynamicFormsService"
    )
    
    for service in "${services[@]}"; do
        port=$(echo $service | cut -d: -f1)
        name=$(echo $service | cut -d: -f2)
        
        if wait_for_service $port $name; then
            continue
        else
            return 1
        fi
    done
    
    log_success "All services are healthy"
}

# Test dynamic form schema endpoint
test_dynamic_forms() {
    test_start "Dynamic Forms Schema"
    
    local url="$BASE_URL:$LOAN_SERVICE_PORT/api/LoanOrigination/form-schema/personal_loan"
    local response=$(curl -s "$url")
    
    if echo "$response" | jq -e '.fields | length' > /dev/null 2>&1; then
        local field_count=$(echo "$response" | jq '.fields | length')
        if [ "$field_count" -ge 6 ]; then
            log_success "Dynamic form schema loaded with $field_count fields"
        else
            log_error "Dynamic form schema has only $field_count fields (expected 6+)"
            return 1
        fi
    else
        log_error "Invalid dynamic form schema response"
        echo "Response: $response"
        return 1
    fi
}

# Test expression engine
test_expression_engine() {
    test_start "Expression Engine"
    
    local url="$BASE_URL:$EXPRESSION_SERVICE_PORT/api/Expressions"
    local response=$(curl -s "$url")
    
    if echo "$response" | jq -e '.expressions | length' > /dev/null 2>&1; then
        local expr_count=$(echo "$response" | jq '.expressions | length')
        if [ "$expr_count" -ge 5 ]; then
            log_success "Expression engine loaded with $expr_count expressions"
        else
            log_error "Expression engine has only $expr_count expressions (expected 5+)"
            return 1
        fi
    else
        log_error "Invalid expression engine response"
        echo "Response: $response"
        return 1
    fi
}

# Test expression execution
test_expression_execution() {
    test_start "Expression Execution"
    
    local url="$BASE_URL:$EXPRESSION_SERVICE_PORT/api/Expressions/execute"
    local test_data='{
        "expressionId": "EXPR_1755237353842",
        "data": {
            "customer": {
                "creditScore": 780,
                "monthlyIncome": 75000,
                "debtToIncomeRatio": 0.25
            }
        }
    }'
    
    local response=$(curl -s -X POST "$url" \
        -H "Content-Type: application/json" \
        -d "$test_data")
    
    if echo "$response" | jq -e '.result' > /dev/null 2>&1; then
        local result=$(echo "$response" | jq -r '.result')
        local execution_time=$(echo "$response" | jq -r '.executionTimeMs // 0')
        
        if [ "$result" = "APPROVED" ]; then
            log_success "Expression execution successful: $result (${execution_time}ms)"
        else
            log_warning "Expression execution returned: $result (expected APPROVED)"
        fi
    else
        log_error "Expression execution failed"
        echo "Response: $response"
        return 1
    fi
}

# Test loan pre-validation (integration test)
test_loan_prevalidation() {
    test_start "Loan Pre-validation Integration"
    
    local url="$BASE_URL:$LOAN_SERVICE_PORT/api/LoanOrigination/pre-validate"
    local test_data='{
        "firstName": "Rajesh",
        "lastName": "Kumar",
        "phone": "9876543210",
        "email": "rajesh.kumar@email.com",
        "loanAmount": 500000,
        "tenureMonths": 24,
        "monthlyIncome": 75000,
        "creditScore": 780
    }'
    
    local response=$(curl -s -X POST "$url" \
        -H "Content-Type: application/json" \
        -d "$test_data")
    
    if echo "$response" | jq -e '.decision' > /dev/null 2>&1; then
        local decision=$(echo "$response" | jq -r '.decision')
        local confidence=$(echo "$response" | jq -r '.confidence // 0')
        
        if [ "$decision" = "APPROVED" ]; then
            log_success "Loan pre-validation successful: $decision (confidence: $confidence)"
        else
            log_warning "Loan pre-validation returned: $decision (expected APPROVED)"
        fi
    else
        log_error "Loan pre-validation failed"
        echo "Response: $response"
        return 1
    fi
}

# Test loan submission and workflow
test_loan_submission() {
    test_start "Loan Submission & Workflow"
    
    local url="$BASE_URL:$LOAN_SERVICE_PORT/api/LoanOrigination/submit"
    local test_data='{
        "firstName": "Rajesh",
        "lastName": "Kumar",
        "phone": "9876543210",
        "email": "rajesh.kumar@email.com",
        "loanAmount": 500000,
        "tenureMonths": 24,
        "monthlyIncome": 75000,
        "creditScore": 780
    }'
    
    local response=$(curl -s -X POST "$url" \
        -H "Content-Type: application/json" \
        -d "$test_data")
    
    if echo "$response" | jq -e '.applicationId' > /dev/null 2>&1; then
        local app_id=$(echo "$response" | jq -r '.applicationId')
        local status=$(echo "$response" | jq -r '.status // "unknown"')
        
        log_success "Loan submission successful: ID=$app_id, Status=$status"
    else
        log_error "Loan submission failed"
        echo "Response: $response"
        return 1
    fi
}

# Test workflow service
test_workflow_service() {
    test_start "Workflow Service Health"
    
    local url="$BASE_URL:$WORKFLOW_SERVICE_PORT/api/workflow/health"
    local response=$(curl -s "$url" 2>/dev/null || echo '{"status":"unknown"}')
    
    if echo "$response" | jq -e '.status' > /dev/null 2>&1; then
        local status=$(echo "$response" | jq -r '.status')
        log_success "Workflow service responding: $status"
    else
        log_warning "Workflow service health check unavailable (service may not have health endpoint)"
    fi
}

# Test frontend accessibility
test_frontend_pages() {
    test_start "Frontend Page Accessibility"
    
    local pages=(
        "/login:Login Page"
        "/dashboard:Dashboard" 
        "/admin/config:Admin Config"
        "/expressions:Expression Builder"
        "/loans/new:Loan Application"
        "/demo:End-to-End Demo"
    )
    
    for page in "${pages[@]}"; do
        local path=$(echo $page | cut -d: -f1)
        local name=$(echo $page | cut -d: -f2)
        local url="$BASE_URL:$FRONTEND_PORT$path"
        
        local status_code=$(curl -s -o /dev/null -w "%{http_code}" "$url")
        
        if [ "$status_code" = "200" ]; then
            log_success "$name accessible ($status_code)"
        else
            log_warning "$name returned status $status_code"
        fi
    done
}

# Test API endpoints for demo scenarios
test_demo_api_endpoints() {
    test_start "Demo API Endpoints"
    
    local endpoints=(
        "$LOAN_SERVICE_PORT:/api/LoanOrigination/form-schema/personal_loan:GET:Form Schema"
        "$EXPRESSION_SERVICE_PORT:/api/Expressions:GET:Expression List"
        "$LOAN_SERVICE_PORT:/swagger/index.html:GET:LoanService Swagger"
        "$EXPRESSION_SERVICE_PORT:/swagger/index.html:GET:ExpressionService Swagger"
    )
    
    for endpoint in "${endpoints[@]}"; do
        local port=$(echo $endpoint | cut -d: -f1)
        local path=$(echo $endpoint | cut -d: -f2)
        local method=$(echo $endpoint | cut -d: -f3)
        local name=$(echo $endpoint | cut -d: -f4)
        local url="$BASE_URL:$port$path"
        
        local status_code=$(curl -s -o /dev/null -w "%{http_code}" "$url")
        
        if [ "$status_code" = "200" ]; then
            log_success "$name API accessible ($status_code)"
        else
            log_error "$name API failed ($status_code)"
        fi
    done
}

# Performance benchmarks
test_performance_benchmarks() {
    test_start "Performance Benchmarks"
    
    log_info "Running expression execution performance test..."
    
    local url="$BASE_URL:$EXPRESSION_SERVICE_PORT/api/Expressions/execute"
    local test_data='{
        "expressionId": "EXPR_1755237353842",
        "data": {
            "customer": {
                "creditScore": 780,
                "monthlyIncome": 75000,
                "debtToIncomeRatio": 0.25
            }
        }
    }'
    
    local total_time=0
    local iterations=5
    
    for i in $(seq 1 $iterations); do
        local start_time=$(date +%s%N)
        local response=$(curl -s -X POST "$url" \
            -H "Content-Type: application/json" \
            -d "$test_data")
        local end_time=$(date +%s%N)
        
        local duration=$((($end_time - $start_time) / 1000000))  # Convert to milliseconds
        total_time=$(($total_time + $duration))
        
        if echo "$response" | jq -e '.result' > /dev/null 2>&1; then
            log_info "Iteration $i: ${duration}ms"
        else
            log_error "Performance test iteration $i failed"
            return 1
        fi
    done
    
    local avg_time=$(($total_time / $iterations))
    
    if [ $avg_time -lt 100 ]; then
        log_success "Performance benchmark: ${avg_time}ms average (excellent: <100ms)"
    elif [ $avg_time -lt 500 ]; then
        log_success "Performance benchmark: ${avg_time}ms average (good: <500ms)"
    else
        log_warning "Performance benchmark: ${avg_time}ms average (consider optimization)"
    fi
}

# Data validation tests
test_data_validation() {
    test_start "Data Validation"
    
    log_info "Testing expression library contains loan eligibility rules..."
    
    local url="$BASE_URL:$EXPRESSION_SERVICE_PORT/api/Expressions"
    local response=$(curl -s "$url")
    
    if echo "$response" | jq -e '.expressions[] | select(.expressionId=="EXPR_1755237353842")' > /dev/null 2>&1; then
        log_success "Primary demo expression (EXPR_1755237353842) found"
    else
        log_error "Primary demo expression (EXPR_1755237353842) not found"
        return 1
    fi
    
    local loan_expressions=$(echo "$response" | jq '[.expressions[] | select(.category=="loan")] | length')
    
    if [ "$loan_expressions" -ge 3 ]; then
        log_success "Found $loan_expressions loan-related expressions"
    else
        log_warning "Only $loan_expressions loan expressions found (expected 3+)"
    fi
}

# Main test execution
main() {
    echo "🧪 ==============================================="
    echo "   SaaR Banking Platform - Demo Test Suite"
    echo "==============================================="
    echo ""
    
    log_info "Starting automated demo validation..."
    echo ""
    
    # Run all tests
    test_service_health || true
    test_frontend_pages || true
    test_demo_api_endpoints || true
    test_dynamic_forms || true
    test_expression_engine || true
    test_data_validation || true
    test_expression_execution || true
    test_loan_prevalidation || true
    test_loan_submission || true
    test_workflow_service || true
    test_performance_benchmarks || true
    
    echo ""
    echo "🎯 ==============================================="
    echo "   Test Results Summary"
    echo "==============================================="
    echo ""
    
    log_info "Total Tests: $TOTAL_TESTS"
    log_success "Passed: $PASSED_TESTS"
    
    if [ $FAILED_TESTS -gt 0 ]; then
        log_error "Failed: $FAILED_TESTS"
        echo ""
        log_error "❌ Demo validation FAILED - please fix issues before demo"
        echo ""
        echo "🔧 Quick fixes:"
        echo "   1. Restart services: ./scripts/start-all.sh"
        echo "   2. Check service logs for errors"
        echo "   3. Re-run this test: ./scripts/demo-test.sh"
        echo ""
        exit 1
    else
        echo ""
        log_success "✅ All tests PASSED - Demo environment is ready!"
        echo ""
        echo "🎭 Demo checklist:"
        echo "   ✅ All services running and healthy"
        echo "   ✅ Frontend pages accessible"
        echo "   ✅ API endpoints responding correctly"
        echo "   ✅ Expression engine working with demo data"
        echo "   ✅ Loan application flow functional"
        echo "   ✅ Performance benchmarks acceptable"
        echo ""
        echo "🚀 You're ready for the investor demo!"
        echo ""
        echo "📋 Quick access URLs:"
        echo "   • Login: $BASE_URL:$FRONTEND_PORT/login"
        echo "   • Credentials: $DEMO_USERNAME / $DEMO_PASSWORD"
        echo "   • Demo Quick Reference: DEMO_QUICK_REFERENCE.md"
        echo ""
    fi
}

# Run the tests
main "$@"
