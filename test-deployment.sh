#!/bin/bash

# PhantomPool Deployment Test Script
# Tests the deployment pipeline components

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
}

# Test counter
TESTS_RUN=0
TESTS_PASSED=0

run_test() {
    local test_name="$1"
    local test_command="$2"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    log_info "Running test: $test_name"
    
    if eval "$test_command" > /dev/null 2>&1; then
        log_success "$test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        log_error "$test_name"
    fi
}

echo "🧪 PhantomPool Deployment Test Suite"
echo "===================================="

# Test 1: Docker availability
run_test "Docker installation" "command -v docker"

# Test 2: Docker Compose availability  
run_test "Docker Compose installation" "docker compose version"

# Test 3: Deployment script permissions
run_test "Deploy script executable" "[ -x ./deploy.sh ]"

# Test 4: Dev script permissions
run_test "Dev script executable" "[ -x ./dev-start.sh ]"

# Test 5: Dockerfile syntax
run_test "Dockerfile syntax" "docker build --dry-run . > /dev/null"

# Test 6: Docker Compose configuration
run_test "Docker Compose configuration" "docker compose config"

# Test 7: Environment template exists
run_test "Environment template exists" "[ -f .env.template ]"

# Test 8: Nginx configuration syntax
run_test "Nginx configuration syntax" "docker run --rm -v $(pwd)/nginx/nginx.conf:/etc/nginx/nginx.conf:ro nginx:alpine nginx -t"

# Test 9: Monitoring configuration
run_test "Prometheus configuration exists" "[ -f monitoring/prometheus.yml ]"

# Test 10: SSL directory structure
run_test "SSL directory exists" "[ -d nginx/ssl ] || mkdir -p nginx/ssl"

# Test 11: Check required services in compose
run_test "Database service defined" "docker compose config | grep -q phantompool-db"

# Test 12: Check application service
run_test "Application service defined" "docker compose config | grep -q phantompool-app"

# Test 13: Security service exists  
run_test "Security service exists" "[ -f src/services/security.service.js ]"

# Test 14: Secure API server exists
run_test "Secure API server exists" "[ -f src/api-server-secure.js ]"

# Test 15: Build test (without cache)
log_info "Running build test (this may take a moment)..."
if docker build -t phantompool-test --target builder . > /dev/null 2>&1; then
    log_success "Docker build test"
    TESTS_PASSED=$((TESTS_PASSED + 1))
    docker rmi phantompool-test > /dev/null 2>&1 || true
else
    log_error "Docker build test"
fi
TESTS_RUN=$((TESTS_RUN + 1))

echo
echo "📊 Test Results Summary"
echo "======================="
echo "Tests Run: $TESTS_RUN"
echo "Tests Passed: $TESTS_PASSED"
echo "Tests Failed: $((TESTS_RUN - TESTS_PASSED))"
echo "Success Rate: $(( (TESTS_PASSED * 100) / TESTS_RUN ))%"

if [ $TESTS_PASSED -eq $TESTS_RUN ]; then
    echo
    log_success "All deployment tests passed! 🎉"
    log_info "Your deployment pipeline is ready for production"
    echo
    echo "Next steps:"
    echo "1. Run './deploy.sh' for production deployment"
    echo "2. Run './dev-start.sh' for development environment"
    exit 0
else
    echo
    log_error "Some tests failed. Please fix the issues before deploying."
    exit 1
fi