#!/bin/bash

# PhantomPool Native Deployment (No Docker Required)
# Production deployment using native Node.js and system services

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# Configuration
PROJECT_NAME="phantompool"
VERSION="${VERSION:-$(date +%Y%m%d-%H%M%S)}"
INSTALL_DIR="${INSTALL_DIR:-/opt/phantompool}"
SERVICE_USER="${SERVICE_USER:-phantompool}"
LOG_DIR="/var/log/phantompool"
DATA_DIR="/var/lib/phantompool"

check_requirements() {
    log_info "Checking native deployment requirements..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed. Please install Node.js 16+ and try again."
        exit 1
    fi
    
    local node_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$node_version" -lt 16 ]; then
        log_error "Node.js version 16+ required. Found: $(node --version)"
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed"
        exit 1
    fi
    
    # Check if running as root (required for service installation)
    if [ "$EUID" -ne 0 ]; then
        log_error "This script must be run as root (use sudo)"
        exit 1
    fi
    
    # Check PostgreSQL
    if ! command -v psql &> /dev/null; then
        log_warning "PostgreSQL client not found. Install with: sudo apt-get install postgresql-client"
    fi
    
    log_success "All requirements satisfied"
}

create_system_user() {
    log_info "Creating system user: $SERVICE_USER"
    
    if ! id "$SERVICE_USER" &>/dev/null; then
        useradd --system --shell /bin/false --home-dir "$INSTALL_DIR" --create-home "$SERVICE_USER"
        log_success "System user created: $SERVICE_USER"
    else
        log_warning "System user already exists: $SERVICE_USER"
    fi
}

create_directories() {
    log_info "Creating directories..."
    
    # Create directories
    mkdir -p "$INSTALL_DIR"
    mkdir -p "$LOG_DIR"
    mkdir -p "$DATA_DIR"
    mkdir -p "$DATA_DIR/uploads"
    mkdir -p "$DATA_DIR/backups"
    
    # Set permissions
    chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"
    chown -R "$SERVICE_USER:$SERVICE_USER" "$LOG_DIR"
    chown -R "$SERVICE_USER:$SERVICE_USER" "$DATA_DIR"
    
    # Set directory permissions
    chmod 755 "$INSTALL_DIR"
    chmod 755 "$LOG_DIR"
    chmod 755 "$DATA_DIR"
    
    log_success "Directories created and permissions set"
}

install_application() {
    log_info "Installing PhantomPool application..."
    
    # Copy application files
    cp -r . "$INSTALL_DIR/"
    
    # Change to install directory
    cd "$INSTALL_DIR"
    
    # Install dependencies
    log_info "Installing Node.js dependencies..."
    sudo -u "$SERVICE_USER" npm ci --only=production --silent
    
    # Create production environment file
    if [ ! -f "$INSTALL_DIR/.env" ]; then
        log_info "Creating production environment file..."
        sudo -u "$SERVICE_USER" cat > "$INSTALL_DIR/.env" << EOF
NODE_ENV=production
PORT=3001
LOG_LEVEL=info
LOG_FORMAT=json

# Paths
LOG_DIR=$LOG_DIR
DATA_DIR=$DATA_DIR

# Database (configure your PostgreSQL)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=phantompool
POSTGRES_USER=phantompool
POSTGRES_PASSWORD=$(openssl rand -base64 32)

# Security
JWT_SECRET=$(openssl rand -base64 64)
API_KEY=$(openssl rand -base64 32)
CORS_ORIGINS=https://phantompool.app

# Rate Limiting
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100
ADMIN_RATE_LIMIT_MAX=10

VERSION=$VERSION
DEPLOYMENT_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
EOF
        chown "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR/.env"
        chmod 600 "$INSTALL_DIR/.env"
        log_success "Environment file created with secure passwords"
    fi
    
    log_success "Application installed"
}

create_systemd_service() {
    log_info "Creating systemd service..."
    
    cat > /etc/systemd/system/phantompool.service << EOF
[Unit]
Description=PhantomPool Application
Documentation=https://github.com/your-org/phantompool
After=network.target postgresql.service

[Service]
Type=simple
User=$SERVICE_USER
Group=$SERVICE_USER
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/node src/api-server-secure.js
ExecReload=/bin/kill -HUP \$MAINPID
Restart=on-failure
RestartSec=5
StartLimitInterval=60s
StartLimitBurst=5

# Environment
Environment=NODE_ENV=production
EnvironmentFile=$INSTALL_DIR/.env

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$LOG_DIR $DATA_DIR
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true

# Resource limits
LimitNOFILE=65536
LimitNPROC=32768

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=phantompool

[Install]
WantedBy=multi-user.target
EOF

    # Reload systemd and enable service
    systemctl daemon-reload
    systemctl enable phantompool.service
    
    log_success "Systemd service created and enabled"
}

create_logrotate_config() {
    log_info "Creating log rotation configuration..."
    
    cat > /etc/logrotate.d/phantompool << EOF
$LOG_DIR/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 640 $SERVICE_USER $SERVICE_USER
    postrotate
        systemctl reload phantompool.service > /dev/null 2>&1 || true
    endscript
}
EOF

    log_success "Log rotation configured"
}

setup_nginx() {
    log_info "Setting up Nginx configuration..."
    
    if command -v nginx &> /dev/null; then
        # Create Nginx site configuration
        cat > /etc/nginx/sites-available/phantompool << 'EOF'
server {
    listen 80;
    server_name phantompool.app www.phantompool.app;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name phantompool.app www.phantompool.app;
    
    # SSL configuration
    ssl_certificate /etc/ssl/certs/phantompool.crt;
    ssl_certificate_key /etc/ssl/private/phantompool.key;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=general:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=api:10m rate=5r/s;
    
    # Proxy to Node.js application
    location / {
        limit_req zone=general burst=20 nodelay;
        
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # API endpoints with stricter rate limiting
    location /api/ {
        limit_req zone=api burst=10 nodelay;
        
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Health check
    location /health {
        access_log off;
        proxy_pass http://127.0.0.1:3001/api/health;
    }
}
EOF

        # Enable site
        ln -sf /etc/nginx/sites-available/phantompool /etc/nginx/sites-enabled/
        
        # Test configuration
        if nginx -t; then
            systemctl reload nginx
            log_success "Nginx configuration created and reloaded"
        else
            log_warning "Nginx configuration test failed"
        fi
    else
        log_warning "Nginx not installed. Install with: sudo apt-get install nginx"
    fi
}

create_backup_script() {
    log_info "Creating backup script..."
    
    cat > "$INSTALL_DIR/backup.sh" << EOF
#!/bin/bash
# PhantomPool Backup Script

BACKUP_DIR="$DATA_DIR/backups"
DATE=\$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="\$BACKUP_DIR/phantompool_backup_\$DATE.tar.gz"

# Create backup directory
mkdir -p "\$BACKUP_DIR"

# Create application backup
tar -czf "\$BACKUP_FILE" \\
    --exclude="$DATA_DIR/backups" \\
    --exclude="node_modules" \\
    --exclude="*.log" \\
    "$INSTALL_DIR" \\
    "$LOG_DIR" \\
    "$DATA_DIR"

echo "Backup created: \$BACKUP_FILE"

# Keep only last 7 days of backups
find "\$BACKUP_DIR" -name "phantompool_backup_*.tar.gz" -mtime +7 -delete

# Database backup (if PostgreSQL is available)
if command -v pg_dump &> /dev/null; then
    DB_BACKUP="\$BACKUP_DIR/database_\$DATE.sql"
    pg_dump -h localhost -U phantompool phantompool > "\$DB_BACKUP" 2>/dev/null || echo "Database backup failed"
fi
EOF

    chmod +x "$INSTALL_DIR/backup.sh"
    chown "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR/backup.sh"
    
    # Create daily cron job
    cat > /etc/cron.d/phantompool-backup << EOF
# PhantomPool daily backup
0 2 * * * $SERVICE_USER $INSTALL_DIR/backup.sh >/dev/null 2>&1
EOF

    log_success "Backup script and cron job created"
}

start_service() {
    log_info "Starting PhantomPool service..."
    
    # Start the service
    systemctl start phantompool.service
    
    # Wait for startup
    sleep 5
    
    # Check service status
    if systemctl is-active --quiet phantompool.service; then
        log_success "PhantomPool service started successfully"
        
        # Check application health
        sleep 5
        if curl -f -s http://localhost:3001/api/health > /dev/null; then
            log_success "Application health check passed"
        else
            log_warning "Application health check failed"
        fi
    else
        log_error "Failed to start PhantomPool service"
        systemctl status phantompool.service
        exit 1
    fi
}

show_deployment_info() {
    log_success "Native deployment completed successfully!"
    echo
    echo "==============================================================================="
    echo "PhantomPool Native Deployment Information"
    echo "==============================================================================="
    echo "Version: $VERSION"
    echo "Installation Directory: $INSTALL_DIR"
    echo "Service User: $SERVICE_USER"
    echo "Log Directory: $LOG_DIR"
    echo "Data Directory: $DATA_DIR"
    echo
    echo "Service Status:"
    systemctl status phantompool.service --no-pager
    echo
    echo "Application URL: http://localhost:3001"
    echo "Health Check: http://localhost:3001/api/health"
    echo
    echo "Useful Commands:"
    echo "  - View logs: journalctl -u phantompool.service -f"
    echo "  - Restart service: sudo systemctl restart phantompool.service"
    echo "  - Stop service: sudo systemctl stop phantompool.service"
    echo "  - Check status: sudo systemctl status phantompool.service"
    echo "  - Create backup: sudo -u $SERVICE_USER $INSTALL_DIR/backup.sh"
    echo
    echo "Configuration file: $INSTALL_DIR/.env"
    echo "==============================================================================="
}

# Main deployment function
main() {
    echo "🚀 PhantomPool Native Deployment (No Docker Required)"
    echo "====================================================="
    
    check_requirements
    create_system_user
    create_directories
    install_application
    create_systemd_service
    create_logrotate_config
    setup_nginx
    create_backup_script
    start_service
    show_deployment_info
    
    log_success "PhantomPool native deployment completed successfully!"
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi