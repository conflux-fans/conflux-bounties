#!/bin/bash

# Deployment Testing Script for Webhook Relay System
# This script tests the Docker deployment to ensure all components are working correctly

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
HEALTH_URL="http://localhost:3001/health"
METRICS_URL="http://localhost:3001/metrics"
POSTGRES_CONTAINER="webhook-relay-postgres"
REDIS_CONTAINER="webhook-relay-redis"
APP_CONTAINER="webhook-relay-app"
TIMEOUT=60

# Helper functions
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

# Wait for service to be ready
wait_for_service() {
    local service_name=$1
    local check_command=$2
    local timeout=$3
    local counter=0
    
    log_info "Waiting for $service_name to be ready..."
    
    while [ $counter -lt $timeout ]; do
        if eval $check_command > /dev/null 2>&1; then
            log_success "$service_name is ready"
            return 0
        fi
        
        counter=$((counter + 1))
        sleep 1
        
        if [ $((counter % 10)) -eq 0 ]; then
            log_info "Still waiting for $service_name... (${counter}s)"
        fi
    done
    
    log_error "$service_name failed to become ready within ${timeout}s"
    return 1
}

# Test functions
test_docker_compose() {
    log_info "Testing Docker Compose setup..."
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "docker-compose is not installed"
        return 1
    fi
    
    if ! docker-compose --version; then
        log_error "docker-compose is not working properly"
        return 1
    fi
    
    log_success "Docker Compose is available"
}

test_containers_running() {
    log_info "Checking if containers are running..."
    
    local containers=("$POSTGRES_CONTAINER" "$REDIS_CONTAINER" "$APP_CONTAINER")
    
    for container in "${containers[@]}"; do
        if ! docker ps --format "table {{.Names}}" | grep -q "$container"; then
            log_error "Container $container is not running"
            return 1
        fi
        log_success "Container $container is running"
    done
}

test_postgres_health() {
    log_info "Testing PostgreSQL health..."
    
    if ! wait_for_service "PostgreSQL" "docker exec $POSTGRES_CONTAINER pg_isready -U webhook_user -d webhook_relay" $TIMEOUT; then
        return 1
    fi
    
    # Test database connection and tables
    log_info "Checking database tables..."
    local tables=$(docker exec $POSTGRES_CONTAINER psql -U webhook_user -d webhook_relay -t -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public';" | tr -d ' ' | grep -v '^$')
    
    local expected_tables=("subscriptions" "webhooks" "deliveries" "metrics")
    for table in "${expected_tables[@]}"; do
        if echo "$tables" | grep -q "$table"; then
            log_success "Table $table exists"
        else
            log_error "Table $table is missing"
            return 1
        fi
    done
}

test_redis_health() {
    log_info "Testing Redis health..."
    
    if ! wait_for_service "Redis" "docker exec $REDIS_CONTAINER redis-cli ping" $TIMEOUT; then
        return 1
    fi
    
    # Test Redis operations
    log_info "Testing Redis operations..."
    if docker exec $REDIS_CONTAINER redis-cli set test_key test_value > /dev/null; then
        local value=$(docker exec $REDIS_CONTAINER redis-cli get test_key)
        if [ "$value" = "test_value" ]; then
            log_success "Redis read/write operations working"
            docker exec $REDIS_CONTAINER redis-cli del test_key > /dev/null
        else
            log_error "Redis read operation failed"
            return 1
        fi
    else
        log_error "Redis write operation failed"
        return 1
    fi
}

test_application_health() {
    log_info "Testing application health endpoint..."
    
    if ! wait_for_service "Application" "curl -f $HEALTH_URL" $TIMEOUT; then
        return 1
    fi
    
    # Test health endpoint response
    local health_response=$(curl -s $HEALTH_URL)
    if echo "$health_response" | grep -q '"status"'; then
        log_success "Health endpoint is responding with valid JSON"
        
        # Check if status is healthy
        if echo "$health_response" | grep -q '"status":"healthy"'; then
            log_success "Application status is healthy"
        else
            log_warning "Application status is not healthy: $health_response"
        fi
    else
        log_error "Health endpoint is not returning valid JSON"
        return 1
    fi
}

test_metrics_endpoint() {
    log_info "Testing metrics endpoint..."
    
    local metrics_response=$(curl -s $METRICS_URL)
    if [ $? -eq 0 ]; then
        if echo "$metrics_response" | grep -q '{'; then
            log_success "Metrics endpoint is responding with JSON"
        else
            log_warning "Metrics endpoint is not returning JSON"
        fi
    else
        log_warning "Metrics endpoint is not accessible (this may be disabled)"
    fi
}

test_application_logs() {
    log_info "Checking application logs for errors..."
    
    local error_count=$(docker logs $APP_CONTAINER 2>&1 | grep -i error | wc -l)
    local warning_count=$(docker logs $APP_CONTAINER 2>&1 | grep -i warning | wc -l)
    
    if [ $error_count -eq 0 ]; then
        log_success "No errors found in application logs"
    else
        log_warning "Found $error_count errors in application logs"
        log_info "Recent errors:"
        docker logs $APP_CONTAINER 2>&1 | grep -i error | tail -5
    fi
    
    if [ $warning_count -eq 0 ]; then
        log_success "No warnings found in application logs"
    else
        log_info "Found $warning_count warnings in application logs"
    fi
}

test_network_connectivity() {
    log_info "Testing network connectivity between containers..."
    
    # Test app -> postgres
    if docker exec $APP_CONTAINER nc -z postgres 5432; then
        log_success "Application can connect to PostgreSQL"
    else
        log_error "Application cannot connect to PostgreSQL"
        return 1
    fi
    
    # Test app -> redis
    if docker exec $APP_CONTAINER nc -z redis 6379; then
        log_success "Application can connect to Redis"
    else
        log_error "Application cannot connect to Redis"
        return 1
    fi
}

test_resource_usage() {
    log_info "Checking resource usage..."
    
    local containers=("$POSTGRES_CONTAINER" "$REDIS_CONTAINER" "$APP_CONTAINER")
    
    for container in "${containers[@]}"; do
        local stats=$(docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}" $container)
        log_info "$container resource usage:"
        echo "$stats" | tail -1
    done
}

# Configuration tests
test_configuration() {
    log_info "Testing configuration..."
    
    # Check if config file exists in container
    if docker exec $APP_CONTAINER test -f /app/config.json; then
        log_success "Configuration file exists in container"
        
        # Validate JSON
        if docker exec $APP_CONTAINER node -e "JSON.parse(require('fs').readFileSync('/app/config.json', 'utf8'))"; then
            log_success "Configuration file is valid JSON"
        else
            log_error "Configuration file is not valid JSON"
            return 1
        fi
    else
        log_error "Configuration file not found in container"
        return 1
    fi
}

# Main test execution
main() {
    log_info "Starting deployment tests for Webhook Relay System"
    log_info "================================================"
    
    local failed_tests=0
    
    # Array of test functions
    local tests=(
        "test_docker_compose"
        "test_containers_running"
        "test_postgres_health"
        "test_redis_health"
        "test_configuration"
        "test_network_connectivity"
        "test_application_health"
        "test_metrics_endpoint"
        "test_application_logs"
        "test_resource_usage"
    )
    
    # Run all tests
    for test in "${tests[@]}"; do
        echo
        if ! $test; then
            failed_tests=$((failed_tests + 1))
        fi
    done
    
    echo
    log_info "================================================"
    
    if [ $failed_tests -eq 0 ]; then
        log_success "All tests passed! Deployment is healthy."
        exit 0
    else
        log_error "$failed_tests test(s) failed. Please check the deployment."
        exit 1
    fi
}

# Handle script arguments
case "${1:-}" in
    "health")
        test_application_health
        ;;
    "postgres")
        test_postgres_health
        ;;
    "redis")
        test_redis_health
        ;;
    "logs")
        test_application_logs
        ;;
    "resources")
        test_resource_usage
        ;;
    "")
        main
        ;;
    *)
        echo "Usage: $0 [health|postgres|redis|logs|resources]"
        echo "  health    - Test only application health"
        echo "  postgres  - Test only PostgreSQL"
        echo "  redis     - Test only Redis"
        echo "  logs      - Check only application logs"
        echo "  resources - Check only resource usage"
        echo "  (no args) - Run all tests"
        exit 1
        ;;
esac