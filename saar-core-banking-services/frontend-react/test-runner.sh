#!/bin/bash

# Expression Builder Test Runner
# This script runs both unit tests and E2E tests for the Expression Builder

echo "🧪 Expression Builder Test Suite"
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if services are running
check_services() {
    echo -e "${YELLOW}📋 Checking required services...${NC}"
    
    # Check if backend is running on port 5001
    if curl -s http://localhost:5001/api/expressions > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend API is running on port 5001${NC}"
    else
        echo -e "${RED}❌ Backend API is not running on port 5001${NC}"
        echo "Please start the backend with: cd ExpressionBuilderService && dotnet run --urls=\"http://localhost:5001\""
        exit 1
    fi
    
    # Check if frontend is running on port 3001
    if curl -s http://localhost:3001 > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Frontend is running on port 3001${NC}"
    else
        echo -e "${RED}❌ Frontend is not running on port 3001${NC}"
        echo "Please start the frontend with: serve -s build -p 3001"
        exit 1
    fi
    
    echo ""
}

# Function to run unit tests
run_unit_tests() {
    echo -e "${YELLOW}🔬 Running Unit Tests...${NC}"
    
    # Run Jest tests
    npm test -- --coverage --watchAll=false --testPathPattern="integration" 2>/dev/null
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Unit tests passed!${NC}"
    else
        echo -e "${RED}❌ Unit tests failed!${NC}"
        return 1
    fi
    echo ""
}

# Function to run E2E tests
run_e2e_tests() {
    echo -e "${YELLOW}🎭 Running E2E Tests...${NC}"
    
    # Run Cypress tests headlessly
    npx cypress run --spec "cypress/e2e/expression-builder.cy.ts" 2>/dev/null
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ E2E tests passed!${NC}"
    else
        echo -e "${RED}❌ E2E tests failed!${NC}"
        return 1
    fi
    echo ""
}

# Function to run API integration tests
run_api_tests() {
    echo -e "${YELLOW}🌐 Running API Integration Tests...${NC}"
    
    # Test API endpoints directly
    echo "Testing GET /api/expressions..."
    if curl -s -f http://localhost:5001/api/expressions > /dev/null; then
        echo -e "${GREEN}✅ GET /api/expressions works${NC}"
    else
        echo -e "${RED}❌ GET /api/expressions failed${NC}"
        return 1
    fi
    
    # Test CORS preflight
    echo "Testing CORS preflight..."
    cors_response=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS \
        -H "Origin: http://192.168.1.10:3001" \
        -H "Access-Control-Request-Method: POST" \
        -H "Access-Control-Request-Headers: Content-Type" \
        http://localhost:5001/api/expressions)
    
    if [ "$cors_response" = "204" ]; then
        echo -e "${GREEN}✅ CORS preflight works${NC}"
    else
        echo -e "${RED}❌ CORS preflight failed (HTTP $cors_response)${NC}"
        return 1
    fi
    
    echo ""
}

# Main execution
main() {
    # Check if we're in the right directory
    if [ ! -f "package.json" ]; then
        echo -e "${RED}❌ Please run this script from the frontend-react directory${NC}"
        exit 1
    fi
    
    check_services
    
    # Parse command line arguments
    case "${1:-all}" in
        "unit")
            run_unit_tests
            ;;
        "e2e")
            run_e2e_tests
            ;;
        "api")
            run_api_tests
            ;;
        "all")
            echo -e "${YELLOW}🚀 Running complete test suite...${NC}"
            echo ""
            
            run_api_tests
            api_result=$?
            
            run_unit_tests
            unit_result=$?
            
            run_e2e_tests
            e2e_result=$?
            
            # Summary
            echo -e "${YELLOW}📊 Test Results Summary${NC}"
            echo "======================="
            
            if [ $api_result -eq 0 ]; then
                echo -e "API Tests:  ${GREEN}✅ PASSED${NC}"
            else
                echo -e "API Tests:  ${RED}❌ FAILED${NC}"
            fi
            
            if [ $unit_result -eq 0 ]; then
                echo -e "Unit Tests: ${GREEN}✅ PASSED${NC}"
            else
                echo -e "Unit Tests: ${RED}❌ FAILED${NC}"
            fi
            
            if [ $e2e_result -eq 0 ]; then
                echo -e "E2E Tests:  ${GREEN}✅ PASSED${NC}"
            else
                echo -e "E2E Tests:  ${RED}❌ FAILED${NC}"
            fi
            
            echo ""
            
            if [ $api_result -eq 0 ] && [ $unit_result -eq 0 ] && [ $e2e_result -eq 0 ]; then
                echo -e "${GREEN}🎉 All tests passed! Expression Builder is working correctly.${NC}"
                exit 0
            else
                echo -e "${RED}💥 Some tests failed. Please check the output above.${NC}"
                exit 1
            fi
            ;;
        *)
            echo "Usage: $0 [unit|e2e|api|all]"
            echo ""
            echo "  unit  - Run unit/integration tests only"
            echo "  e2e   - Run end-to-end tests only"  
            echo "  api   - Run API integration tests only"
            echo "  all   - Run all tests (default)"
            exit 1
            ;;
    esac
}

main "$@"
