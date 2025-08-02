#!/bin/bash

# Docker Configuration Validation Script
# This script validates the Docker configuration without building

set -e

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

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Validate Dockerfile syntax
validate_dockerfile() {
    log_info "Validating Dockerfile syntax..."
    
    if [ ! -f "Dockerfile" ]; then
        log_error "Dockerfile not found"
        return 1
    fi
    
    # Check for common Dockerfile issues
    if grep -q "^FROM" Dockerfile; then
        log_success "Dockerfile has FROM instruction"
    else
        log_error "Dockerfile missing FROM instruction"
        return 1
    fi
    
    if grep -q "WORKDIR" Dockerfile; then
        log_success "Dockerfile has WORKDIR instruction"
    else
        log_error "Dockerfile missing WORKDIR instruction"
        return 1
    fi
    
    if grep -q "EXPOSE" Dockerfile; then
        log_success "Dockerfile has EXPOSE instruction"
    else
        log_error "Dockerfile missing EXPOSE instruction"
        return 1
    fi
    
    log_success "Dockerfile syntax validation passed"
}

# Validate docker-compose.yml
validate_docker_compose() {
    log_info "Validating docker-compose.yml..."
    
    if [ ! -f "docker-compose.yml" ]; then
        log_error "docker-compose.yml not found"
        return 1
    fi
    
    # Use docker-compose config to validate syntax
    if docker-compose config > /dev/null 2>&1; then
        log_success "docker-compose.yml syntax is valid"
    else
        log_error "docker-compose.yml syntax is invalid"
        docker-compose config
        return 1
    fi
}

# Validate required files
validate_required_files() {
    log_info "Validating required files..."
    
    local required_files=(
        "Dockerfile"
        "docker-compose.yml"
        "docker-compose.dev.yml"
        ".dockerignore"
        ".env.example"
        "config.example.json"
        "scripts/init-db.sql"
        "scripts/test-deployment.sh"
        "DEPLOYMENT.md"
    )
    
    for file in "${required_files[@]}"; do
        if [ -f "$file" ]; then
            log_success "Required file exists: $file"
        else
            log_error "Required file missing: $file"
            return 1
        fi
    done
}

# Validate package.json scripts
validate_package_scripts() {
    log_info "Validating package.json Docker scripts..."
    
    if [ ! -f "package.json" ]; then
        log_error "package.json not found"
        return 1
    fi
    
    local required_scripts=(
        "docker:build"
        "docker:up"
        "docker:down"
        "docker:test"
    )
    
    for script in "${required_scripts[@]}"; do
        if grep -q "\"$script\":" package.json; then
            log_success "Package script exists: $script"
        else
            log_error "Package script missing: $script"
            return 1
        fi
    done
}

# Main validation
main() {
    log_info "Starting Docker configuration validation"
    log_info "========================================"
    
    local failed_validations=0
    
    local validations=(
        "validate_required_files"
        "validate_dockerfile"
        "validate_docker_compose"
        "validate_package_scripts"
    )
    
    for validation in "${validations[@]}"; do
        echo
        if ! $validation; then
            failed_validations=$((failed_validations + 1))
        fi
    done
    
    echo
    log_info "========================================"
    
    if [ $failed_validations -eq 0 ]; then
        log_success "All validations passed! Docker configuration is ready."
        exit 0
    else
        log_error "$failed_validations validation(s) failed."
        exit 1
    fi
}

main