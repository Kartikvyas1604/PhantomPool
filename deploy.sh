#!/bin/bash

# PhantomPool Production Deployment Script
# Automated deployment with security checks and rollback capability

set -euo pipefail

# =============================================================================
# Configuration
# =============================================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_NAME="phantompool"
VERSION="${VERSION:-$(date +%Y%m%d-%H%M%S)}"
ENVIRONMENT="${ENVIRONMENT:-production}"
BACKUP_RETENTION_DAYS=7

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# =============================================================================
# Logging Functions
# =============================================================================
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

# =============================================================================
# Utility Functions
# =============================================================================
check_requirements() {
    log_info "Checking deployment requirements..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    # Check Docker Compose
    if ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi
    
    # Check available disk space (minimum 5GB)
    available_space=$(df / | awk 'NR==2 {print $4}')
    if [ "$available_space" -lt 5242880 ]; then
        log_error "Insufficient disk space. At least 5GB required."
        exit 1
    fi
    
    log_success "All requirements satisfied"
}

create_environment_file() {
    log_info "Creating environment configuration..."
    
    if [ ! -f ".env" ]; then
        cat > .env << EOF
# PhantomPool Production Environment Configuration
NODE_ENV=production
PORT=3001

# Database Configuration
POSTGRES_PASSWORD=$(openssl rand -base64 32)
POSTGRES_HOST=phantompool-db
POSTGRES_PORT=5432
POSTGRES_DB=phantompool
POSTGRES_USER=phantompool

# Redis Configuration
REDIS_PASSWORD=$(openssl rand -base64 32)
REDIS_HOST=phantompool-cache
REDIS_PORT=6379

# Security Configuration
JWT_SECRET=$(openssl rand -base64 64)
API_KEY=$(openssl rand -base64 32)
CORS_ORIGINS=https://phantompool.app,https://www.phantompool.app

# Rate Limiting
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100
ADMIN_RATE_LIMIT_MAX=10

# Monitoring
GRAFANA_PASSWORD=$(openssl rand -base64 16)

# Deployment
VERSION=$VERSION
DEPLOYMENT_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
EOF
        log_success "Environment file created with secure passwords"
    else
        log_warning "Environment file already exists, skipping creation"
    fi
}

backup_data() {
    log_info "Creating data backup..."
    
    local backup_dir="backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$backup_dir"
    
    # Backup database if running
    if docker compose ps phantompool-db | grep -q "Up"; then
        log_info "Backing up database..."
        docker compose exec -T phantompool-db pg_dump -U phantompool phantompool > "$backup_dir/database_backup.sql"
        log_success "Database backup completed"
    fi
    
    # Backup logs
    if [ -d "logs" ]; then
        log_info "Backing up logs..."
        cp -r logs "$backup_dir/"
        log_success "Logs backup completed"
    fi
    
    # Cleanup old backups
    find backups -type d -mtime +$BACKUP_RETENTION_DAYS -exec rm -rf {} + 2>/dev/null || true
    
    log_success "Backup completed: $backup_dir"
}

build_images() {
    log_info "Building Docker images..."
    
    # Build with version tag
    docker compose build --no-cache --parallel
    
    # Tag with version
    docker tag phantompool-phantompool-app:latest phantompool-phantompool-app:$VERSION
    
    log_success "Docker images built successfully"
}

run_security_checks() {
    log_info "Running security checks..."
    
    # Check for vulnerabilities in Docker images
    if command -v docker-scout &> /dev/null; then
        docker scout cves phantompool-phantompool-app:latest --exit-code || log_warning "Security vulnerabilities detected"
    fi
    
    # Check environment file permissions
    if [ -f ".env" ]; then
        chmod 600 .env
        log_success "Environment file permissions secured"
    fi
    
    # Verify SSL certificates if present
    if [ -d "nginx/ssl" ]; then
        for cert in nginx/ssl/*.crt; do
            if [ -f "$cert" ]; then
                expiry=$(openssl x509 -enddate -noout -in "$cert" | cut -d= -f2)
                expiry_date=$(date -d "$expiry" +%s)
                current_date=$(date +%s)
                days_until_expiry=$(( (expiry_date - current_date) / 86400 ))
                
                if [ $days_until_expiry -lt 30 ]; then
                    log_warning "SSL certificate expires in $days_until_expiry days: $cert"
                fi
            fi
        done
    fi
    
    log_success "Security checks completed"
}

deploy_services() {
    log_info "Deploying services..."
    
    # Stop existing services gracefully
    docker compose down --timeout 30
    
    # Start services in correct order
    docker compose up -d phantompool-db phantompool-cache
    
    # Wait for database to be ready
    log_info "Waiting for database to be ready..."
    timeout=60
    while ! docker compose exec -T phantompool-db pg_isready -U phantompool -d phantompool > /dev/null 2>&1; do
        timeout=$((timeout - 1))
        if [ $timeout -le 0 ]; then
            log_error "Database failed to start within timeout"
            exit 1
        fi
        sleep 1
    done
    
    # Start application services
    docker compose up -d phantompool-app phantompool-proxy
    
    # Start monitoring services
    docker compose up -d prometheus grafana
    
    log_success "All services deployed"
}

run_health_checks() {
    log_info "Running health checks..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s http://localhost:3001/api/health > /dev/null; then
            log_success "Application health check passed"
            break
        fi
        
        if [ $attempt -eq $max_attempts ]; then
            log_error "Application health check failed after $max_attempts attempts"
            return 1
        fi
        
        log_info "Health check attempt $attempt/$max_attempts failed, retrying..."
        sleep 5
        attempt=$((attempt + 1))
    done
    
    # Check all services
    services=("phantompool-app" "phantompool-db" "phantompool-cache" "phantompool-proxy")
    for service in "${services[@]}"; do
        if docker compose ps "$service" | grep -q "Up"; then
            log_success "$service is running"
        else
            log_error "$service is not running"
            return 1
        fi
    done
    
    return 0
}

rollback() {
    log_warning "Rolling back deployment..."
    
    # Stop current deployment
    docker compose down
    
    # Restore from backup if available
    latest_backup=$(find backups -type d -name "*" | sort | tail -n 1)
    if [ -n "$latest_backup" ] && [ -d "$latest_backup" ]; then
        log_info "Restoring from backup: $latest_backup"
        
        # Restore database if backup exists
        if [ -f "$latest_backup/database_backup.sql" ]; then
            docker compose up -d phantompool-db
            sleep 10
            docker compose exec -T phantompool-db psql -U phantompool -d phantompool < "$latest_backup/database_backup.sql"
        fi
    fi
    
    log_warning "Rollback completed"
}

show_deployment_info() {
    log_success "Deployment completed successfully!"
    echo
    echo "==============================================================================="
    echo "PhantomPool Deployment Information"
    echo "==============================================================================="
    echo "Version: $VERSION"
    echo "Environment: $ENVIRONMENT"
    echo "Deployment Date: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    echo
    echo "Service URLs:"
    echo "  - Application: http://localhost:3001"
    echo "  - Proxy: http://localhost"
    echo "  - Grafana: http://localhost:3000"
    echo "  - Prometheus: http://localhost:9090"
    echo
    echo "Service Status:"
    docker compose ps
    echo
    echo "Useful Commands:"
    echo "  - View logs: docker compose logs -f [service-name]"
    echo "  - Scale service: docker compose up -d --scale phantompool-app=3"
    echo "  - Update deployment: ./deploy.sh"
    echo "  - Stop services: docker compose down"
    echo "==============================================================================="
}

cleanup() {
    log_info "Cleaning up..."
    
    # Remove unused images
    docker image prune -f
    
    # Remove unused volumes
    docker volume prune -f
    
    log_success "Cleanup completed"
}

# =============================================================================
# Main Deployment Flow
# =============================================================================
main() {
    log_info "Starting PhantomPool deployment..."
    
    # Create necessary directories
    mkdir -p logs backups monitoring nginx/ssl
    
    # Run deployment steps
    check_requirements
    create_environment_file
    backup_data
    build_images
    run_security_checks
    deploy_services
    
    # Health checks with retry logic
    if ! run_health_checks; then
        log_error "Health checks failed, initiating rollback..."
        rollback
        exit 1
    fi
    
    cleanup
    show_deployment_info
    
    log_success "PhantomPool deployment completed successfully!"
}

# =============================================================================
# Script Entry Point
# =============================================================================
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi