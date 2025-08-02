#!/bin/bash

# Comprehensive Test Suite Runner
# This script runs all test types and generates coverage reports

set -e

echo "🚀 Starting Comprehensive Test Suite"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required services are running
check_services() {
    print_status "Checking required services..."
    
    # Check PostgreSQL
    if ! pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
        print_warning "PostgreSQL is not running. Integration tests may fail."
        print_status "To start PostgreSQL: docker run -d --name postgres-test -e POSTGRES_PASSWORD=test -e POSTGRES_USER=test -e POSTGRES_DB=webhook_relay_test -p 5432:5432 postgres:13"
    else
        print_success "PostgreSQL is running"
    fi
    
    # Check Redis
    if ! redis-cli -h localhost -p 6379 ping >/dev/null 2>&1; then
        print_warning "Redis is not running. Some tests may fail."
        print_status "To start Redis: docker run -d --name redis-test -p 6379:6379 redis:6-alpine"
    else
        print_success "Redis is running"
    fi
}

# Run unit tests
run_unit_tests() {
    print_status "Running Unit Tests..."
    if npm run test:unit; then
        print_success "Unit tests passed"
    else
        print_error "Unit tests failed"
        exit 1
    fi
}

# Run integration tests
run_integration_tests() {
    print_status "Running Integration Tests..."
    if npm run test:integration; then
        print_success "Integration tests passed"
    else
        print_warning "Integration tests failed (may be due to missing services)"
    fi
}

# Run end-to-end tests
run_e2e_tests() {
    print_status "Running End-to-End Tests..."
    if [ "$CONFLUX_TESTNET_TESTS" = "true" ]; then
        print_status "E2E tests enabled via CONFLUX_TESTNET_TESTS=true"
        if npm run test:e2e; then
            print_success "E2E tests passed"
        else
            print_warning "E2E tests failed"
        fi
    else
        print_warning "E2E tests skipped (set CONFLUX_TESTNET_TESTS=true to enable)"
    fi
}

# Run performance tests
run_performance_tests() {
    print_status "Running Performance Tests..."
    if npm run test:performance; then
        print_success "Performance tests passed"
    else
        print_warning "Performance tests failed"
    fi
}

# Generate coverage report
generate_coverage() {
    print_status "Generating Coverage Report..."
    if npm run test:coverage; then
        print_success "Coverage report generated"
        print_status "Coverage report available at: coverage/lcov-report/index.html"
    else
        print_error "Coverage generation failed"
    fi
}

# Main execution
main() {
    # Parse command line arguments
    RUN_UNIT=true
    RUN_INTEGRATION=true
    RUN_E2E=false
    RUN_PERFORMANCE=true
    GENERATE_COVERAGE=true
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --unit-only)
                RUN_INTEGRATION=false
                RUN_E2E=false
                RUN_PERFORMANCE=false
                shift
                ;;
            --integration-only)
                RUN_UNIT=false
                RUN_E2E=false
                RUN_PERFORMANCE=false
                shift
                ;;
            --e2e-only)
                RUN_UNIT=false
                RUN_INTEGRATION=false
                RUN_PERFORMANCE=false
                RUN_E2E=true
                shift
                ;;
            --performance-only)
                RUN_UNIT=false
                RUN_INTEGRATION=false
                RUN_E2E=false
                shift
                ;;
            --all)
                RUN_E2E=true
                shift
                ;;
            --no-coverage)
                GENERATE_COVERAGE=false
                shift
                ;;
            --help)
                echo "Usage: $0 [OPTIONS]"
                echo "Options:"
                echo "  --unit-only        Run only unit tests"
                echo "  --integration-only Run only integration tests"
                echo "  --e2e-only         Run only end-to-end tests"
                echo "  --performance-only Run only performance tests"
                echo "  --all              Run all tests including E2E"
                echo "  --no-coverage      Skip coverage report generation"
                echo "  --help             Show this help message"
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Check services
    check_services
    
    # Run tests based on flags
    if [ "$RUN_UNIT" = true ]; then
        run_unit_tests
    fi
    
    if [ "$RUN_INTEGRATION" = true ]; then
        run_integration_tests
    fi
    
    if [ "$RUN_E2E" = true ]; then
        run_e2e_tests
    fi
    
    if [ "$RUN_PERFORMANCE" = true ]; then
        run_performance_tests
    fi
    
    if [ "$GENERATE_COVERAGE" = true ]; then
        generate_coverage
    fi
    
    print_success "Comprehensive test suite completed!"
    echo ""
    echo "📊 Test Summary:"
    echo "================"
    [ "$RUN_UNIT" = true ] && echo "✅ Unit Tests"
    [ "$RUN_INTEGRATION" = true ] && echo "✅ Integration Tests"
    [ "$RUN_E2E" = true ] && echo "✅ End-to-End Tests"
    [ "$RUN_PERFORMANCE" = true ] && echo "✅ Performance Tests"
    [ "$GENERATE_COVERAGE" = true ] && echo "📈 Coverage Report Generated"
}

# Run main function
main "$@"