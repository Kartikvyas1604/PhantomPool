#!/bin/bash

# PhantomPool Development Quick Start Script
# Sets up the development environment with Docker

set -euo pipefail

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

# Check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        log_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    log_success "Docker is running"
}

# Create development environment file
create_dev_env() {
    if [ ! -f ".env" ]; then
        log_info "Creating development environment file..."
        cat > .env << EOF
NODE_ENV=development
PORT=3001
LOG_LEVEL=debug
LOG_FORMAT=pretty

# Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=phantompool_dev
POSTGRES_USER=phantompool
POSTGRES_PASSWORD=devpassword123

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=devredis123

# Security (development only)
JWT_SECRET=dev_jwt_secret_not_for_production_use_only
API_KEY=dev_api_key_12345
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# Rate Limiting (relaxed for development)
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=1000
ADMIN_RATE_LIMIT_MAX=100

# Monitoring
GRAFANA_PASSWORD=admin

VERSION=dev
DEPLOYMENT_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
EOF
        log_success "Development environment file created"
    else
        log_warning "Environment file already exists"
    fi
}

# Start development services
start_dev_services() {
    log_info "Starting development services..."
    
    # Start only database and cache for development
    docker compose up -d phantompool-db phantompool-cache
    
    # Wait for database
    log_info "Waiting for database to be ready..."
    timeout=30
    while ! docker compose exec phantompool-db pg_isready -U phantompool > /dev/null 2>&1; do
        timeout=$((timeout - 1))
        if [ $timeout -le 0 ]; then
            log_error "Database failed to start"
            exit 1
        fi
        sleep 1
    done
    
    log_success "Development services started"
    log_info "Database available at: localhost:5432"
    log_info "Redis available at: localhost:6379"
    log_info ""
    log_info "To start the application in development mode:"
    log_info "  npm install"
    log_info "  npm run dev"
}

# Main function
main() {
    echo "🚀 PhantomPool Development Quick Start"
    echo "======================================"
    
    check_docker
    create_dev_env
    start_dev_services
    
    echo
    log_success "Development environment is ready!"
    echo
    echo "Next steps:"
    echo "1. Install dependencies: npm install"
    echo "2. Start development server: npm run dev"
    echo "3. Open browser: http://localhost:3001"
    echo
    echo "Useful commands:"
    echo "  - View logs: docker compose logs -f"
    echo "  - Stop services: docker compose down"
    echo "  - Reset database: docker compose down -v && ./dev-start.sh"
    echo
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi