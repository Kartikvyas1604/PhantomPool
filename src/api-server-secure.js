/**
 * PhantomPool Secure Production API Server
 * Hardened server with comprehensive security measures
 */

const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const compression = require('compression');

// Import security service
const { getSecurityService } = require('./services/security.service');
const { getMetricsService } = require('./services/metrics.service');
const { getLogger, createRequestLogger } = require('./services/logger.service');
const { PhantomPoolWebSocketService } = require('./websocket/websocket-service');

// Initialize services
const security = getSecurityService();
const metrics = getMetricsService();
const logger = getLogger({
  logLevel: process.env.LOG_LEVEL || 'info',
  enableFileLogging: true,
  logDirectory: path.join(__dirname, '../logs'),
  enableJson: process.env.LOG_FORMAT === 'json'
});

const app = express();
const server = http.createServer(app);

// Trust proxy (for proper IP detection behind load balancers)
app.set('trust proxy', process.env.TRUST_PROXY || 1);

// Security headers (must be first)
app.use(security.getHelmetConfig());

// Compression
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// CORS configuration
app.use(cors(security.getCorsConfig()));

// Security logging
app.use(security.logSecurityEvents());

// Block bad actors
app.use(security.blockBadActors());

// General rate limiting
app.use(security.getRateLimiter());

// Body parsing with size limits
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    // Store raw body for signature verification
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb' 
}));

// Request logging and metrics
app.use(createRequestLogger(logger));
app.use((req, res, next) => {
  const start = Date.now();
  
  metrics.incrementRequestCount();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    metrics.trackResponseTime(duration);
    
    if (res.statusCode >= 400) {
      metrics.incrementErrorCount();
    }
  });
  
  next();
});

// Input validation and sanitization
app.use(security.validateAndSanitize());

// Initialize WebSocket service with security
const wsService = new PhantomPoolWebSocketService(server, '/ws', {
  onConnect: (clientId, ws, req) => {
    // Log connection with IP
    const clientIP = req.ip || req.connection.remoteAddress;
    metrics.incrementWebSocketConnection();
    logger.logWebSocket('connect', clientId, { ip: clientIP });
  },
  onDisconnect: (clientId) => {
    metrics.decrementWebSocketConnection();
    logger.logWebSocket('disconnect', clientId);
  },
  onMessage: (clientId, message) => {
    metrics.incrementWebSocketMessage(message.type);
    logger.logWebSocket('message', clientId, { type: message.type });
  },
  onBroadcast: (channel, message) => {
    metrics.incrementWebSocketBroadcast(channel);
    logger.logWebSocket('broadcast', 'server', { channel, type: message.type });
  }
});

logger.info('WebSocket server initialized with security on /ws');

// =============================================================================
// PUBLIC ENDPOINTS (No authentication required)
// =============================================================================

// Health check (public)
app.get('/api/health', (req, res) => {
  logger.debug('Health check requested');
  
  const health = metrics.getHealth();
  const statusCode = health.status === 'healthy' ? 200 : 
                    health.status === 'warning' ? 200 : 503;
  
  res.status(statusCode).json({
    success: true,
    status: health.status,
    uptime: health.uptime,
    timestamp: health.timestamp,
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    ...health.details
  });
});

// Public trading pairs
app.get('/api/trading/pairs', (req, res) => {
  const pairs = [
    { 
      symbol: 'SOL/USDC', 
      baseAsset: 'SOL', 
      quoteAsset: 'USDC',
      minTradeSize: 0.001,
      maxTradeSize: 10000,
      priceDecimalPlaces: 4,
      quantityDecimalPlaces: 6
    },
    { 
      symbol: 'BTC/USDC', 
      baseAsset: 'BTC', 
      quoteAsset: 'USDC',
      minTradeSize: 0.0001,
      maxTradeSize: 100,
      priceDecimalPlaces: 2,
      quantityDecimalPlaces: 8
    },
    { 
      symbol: 'ETH/USDC', 
      baseAsset: 'ETH', 
      quoteAsset: 'USDC',
      minTradeSize: 0.01,
      maxTradeSize: 1000,
      priceDecimalPlaces: 2,
      quantityDecimalPlaces: 6
    }
  ];
  
  res.json({
    success: true,
    data: pairs
  });
});

// Public orderbook (cached)
app.get('/api/trading/orderbook/:pair', (req, res) => {
  const { pair } = req.params;
  
  // Mock orderbook data (in production, this would come from the matching engine)
  const orderbook = {
    symbol: pair.replace('-', '/'),
    bids: [
      [100.50, 1.5],
      [100.25, 2.0],
      [100.00, 0.8]
    ],
    asks: [
      [100.75, 1.2],
      [101.00, 3.0],
      [101.25, 1.8]
    ],
    timestamp: Date.now()
  };
  
  res.json({
    success: true,
    data: orderbook
  });
});

// =============================================================================
// PROTECTED ENDPOINTS (Authentication required)
// =============================================================================

// Authentication middleware for protected routes
app.use('/api/orders', security.authenticateRequest());
app.use('/api/trades', security.authenticateRequest());
app.use('/api/crypto', security.authenticateRequest());
app.use('/api/admin', security.authenticateRequest(), security.getStrictRateLimiter());

// Order management endpoints
app.post('/api/orders', (req, res) => {
  const { pair, side, amount, price, type = 'limit' } = req.body;
  
  // Create order (mock implementation)
  const order = {
    id: Date.now().toString(),
    pair,
    side,
    amount: parseFloat(amount),
    price: type === 'limit' ? parseFloat(price) : null,
    type,
    status: 'pending',
    createdAt: new Date().toISOString(),
    userId: req.auth?.data?.userId || 'anonymous'
  };
  
  // Log order creation
  logger.logOrder('create', order.id, {
    pair,
    side,
    amount,
    type,
    userId: order.userId
  });
  
  // Update metrics
  metrics.recordOrder(order);
  
  // Broadcast to WebSocket subscribers
  wsService.broadcast('orders', {
    type: 'order_created',
    data: order
  });
  
  res.status(201).json({
    success: true,
    data: order
  });
});

app.get('/api/orders', (req, res) => {
  const { status, limit = 50, offset = 0 } = req.query;
  
  // Mock orders list (in production, this would query the database)
  const orders = [];
  for (let i = 0; i < Math.min(parseInt(limit), 100); i++) {
    orders.push({
      id: (Date.now() - i * 1000).toString(),
      pair: 'SOL/USDC',
      side: i % 2 === 0 ? 'buy' : 'sell',
      amount: (Math.random() * 10).toFixed(4),
      price: (100 + Math.random() * 10).toFixed(2),
      type: 'limit',
      status: status || (i % 3 === 0 ? 'filled' : 'pending'),
      createdAt: new Date(Date.now() - i * 1000).toISOString(),
      userId: req.auth?.data?.userId || 'anonymous'
    });
  }
  
  res.json({
    success: true,
    data: orders,
    pagination: {
      limit: parseInt(limit),
      offset: parseInt(offset),
      total: 1000 // Mock total
    }
  });
});

app.get('/api/orders/:orderId', (req, res) => {
  const { orderId } = req.params;
  
  // Mock order details
  const order = {
    id: orderId,
    pair: 'SOL/USDC',
    side: 'buy',
    amount: 5.0,
    price: 100.50,
    type: 'limit',
    status: 'filled',
    filledAmount: 5.0,
    averagePrice: 100.48,
    createdAt: new Date(Date.now() - 300000).toISOString(),
    updatedAt: new Date().toISOString(),
    userId: req.auth?.data?.userId || 'anonymous'
  };
  
  res.json({
    success: true,
    data: order
  });
});

app.delete('/api/orders/:orderId', (req, res) => {
  const { orderId } = req.params;
  
  logger.logOrder('cancel', orderId, {
    userId: req.auth?.data?.userId || 'anonymous'
  });
  
  res.json({
    success: true,
    message: 'Order cancelled successfully'
  });
});

// Trades endpoints
app.get('/api/trades', (req, res) => {
  const { pair, limit = 50 } = req.query;
  
  // Mock trades list
  const trades = [];
  for (let i = 0; i < Math.min(parseInt(limit), 100); i++) {
    trades.push({
      id: (Date.now() - i * 1000).toString(),
      pair: pair || 'SOL/USDC',
      side: i % 2 === 0 ? 'buy' : 'sell',
      amount: (Math.random() * 5).toFixed(4),
      price: (100 + Math.random() * 5).toFixed(2),
      timestamp: new Date(Date.now() - i * 1000).toISOString(),
      userId: req.auth?.data?.userId || 'anonymous'
    });
  }
  
  res.json({
    success: true,
    data: trades
  });
});

// Crypto service endpoints
app.post('/api/crypto/bulletproof', (req, res) => {
  const { value, blinding } = req.body;
  
  logger.logCrypto('bulletproof_generate', {
    value: value ? 'provided' : 'missing',
    userId: req.auth?.data?.userId
  });
  
  // Mock bulletproof generation
  const proof = {
    proof: 'mock_bulletproof_' + Date.now(),
    commitment: 'mock_commitment_' + Date.now(),
    timestamp: new Date().toISOString()
  };
  
  metrics.recordCryptoOperation('bulletproof', 'generate');
  
  res.json({
    success: true,
    data: proof
  });
});

app.post('/api/crypto/elgamal/encrypt', (req, res) => {
  const { message, publicKey } = req.body;
  
  logger.logCrypto('elgamal_encrypt', {
    messageLength: message ? message.length : 0,
    userId: req.auth?.data?.userId
  });
  
  // Mock ElGamal encryption
  const encrypted = {
    c1: 'mock_c1_' + Date.now(),
    c2: 'mock_c2_' + Date.now(),
    timestamp: new Date().toISOString()
  };
  
  metrics.recordCryptoOperation('elgamal', 'encrypt');
  
  res.json({
    success: true,
    data: encrypted
  });
});

// =============================================================================
// ADMIN ENDPOINTS (Strict authentication and rate limiting)
// =============================================================================

// System metrics
app.get('/api/admin/metrics', (req, res) => {
  logger.debug('Admin metrics requested');
  
  const allMetrics = metrics.getMetrics();
  res.json({
    success: true,
    data: allMetrics
  });
});

// System dashboard
app.get('/api/admin/dashboard', (req, res) => {
  logger.debug('Admin dashboard requested');
  
  const dashboardData = metrics.getDashboard();
  res.json({
    success: true,
    data: dashboardData
  });
});

// WebSocket status
app.get('/api/websocket/status', (req, res) => {
  const wsStatus = wsService.getStatus();
  res.json({
    success: true,
    connected_clients: wsStatus.connected_clients,
    total_connections: wsStatus.total_connections,
    messages_sent: wsStatus.messages_sent,
    messages_received: wsStatus.messages_received,
    channels: wsStatus.channels || {},
    uptime: wsStatus.uptime,
    active_channels: wsStatus.active_channels,
    auth_failures: wsStatus.auth_failures
  });
});

// System logs
app.get('/api/admin/logs', (req, res) => {
  const { level, limit = 100, search } = req.query;
  
  const logs = metrics.getLogs(parseInt(limit), level, search);
  
  res.json({
    success: true,
    data: {
      logs,
      query: { level, limit, search }
    }
  });
});

// Alerts management
app.get('/api/admin/alerts', (req, res) => {
  const { resolved, limit = 100 } = req.query;
  const resolvedFilter = resolved === 'true' ? true : resolved === 'false' ? false : null;
  
  const alerts = metrics.getAlerts(resolvedFilter, parseInt(limit));
  
  res.json({
    success: true,
    data: {
      alerts,
      summary: {
        total: alerts.length,
        unresolved: alerts.filter(a => !a.resolved).length
      }
    }
  });
});

// Security status
app.get('/api/admin/security', (req, res) => {
  const securityStatus = security.getSecurityStatus();
  
  res.json({
    success: true,
    data: securityStatus
  });
});

// Authentication endpoint
app.post('/api/auth/login', security.getStrictRateLimiter(), (req, res) => {
  const { username, password } = req.body;
  
  // Mock authentication (in production, verify against database)
  if (username === 'admin' && password === 'secure_password_123') {
    const tokenData = security.generateAuthToken('admin_user', ['read', 'write', 'admin']);
    
    logger.logSecurity('login_success', { username });
    
    res.json({
      success: true,
      data: tokenData
    });
  } else {
    logger.logSecurity('login_failed', { username, ip: req.ip });
    
    res.status(401).json({
      success: false,
      error: 'Invalid credentials'
    });
  }
});

// WebSocket broadcast endpoint
app.post('/api/websocket/broadcast', (req, res) => {
  const { channel, message } = req.body;
  
  if (!channel || !message) {
    return res.status(400).json({
      success: false,
      error: 'Channel and message are required'
    });
  }
  
  wsService.broadcast(channel, message);
  
  res.json({
    success: true,
    message: 'Broadcast sent successfully'
  });
});

// =============================================================================
// ERROR HANDLING
// =============================================================================

// 404 handler
app.use((req, res, next) => {
  logger.logSecurity('404_not_found', { 
    path: req.originalUrl, 
    method: req.method,
    ip: req.ip 
  });
  
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.originalUrl
  });
});

// Global error handler
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', error);
  
  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    ...(isDevelopment && { details: error.message, stack: error.stack })
  });
});

// =============================================================================
// SERVER STARTUP AND SHUTDOWN
// =============================================================================

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || 'localhost';

server.listen(PORT, HOST, () => {
  metrics.log('info', 'PhantomPool Secure API Server started successfully');
  logger.info('🚀 PhantomPool Secure API Server started successfully');
  logger.info(`📡 Server running on http://${HOST}:${PORT}`);
  logger.info(`🔒 Security: Rate limiting, input validation, authentication enabled`);
  logger.info(`📊 Health check: http://${HOST}:${PORT}/api/health`);
  logger.info(`📈 Admin dashboard: http://${HOST}:${PORT}/api/admin/dashboard`);
  logger.info(`🔒 WebSocket endpoint: ws://${HOST}:${PORT}/ws`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Process ID: ${process.pid}`);
  logger.info(`🛡️ Security features:`);
  logger.info(`  - Helmet security headers`);
  logger.info(`  - CORS protection`);
  logger.info(`  - Rate limiting (100 req/15min general, 10 req/15min admin)`);
  logger.info(`  - Input validation and sanitization`);
  logger.info(`  - Authentication middleware`);
  logger.info(`  - IP blocking for bad actors`);
  logger.info(`  - Security event logging`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  
  server.close(() => {
    logger.info('HTTP server closed');
    
    // Close WebSocket connections
    wsService.close();
    
    // Cleanup services
    security.cleanup();
    
    logger.info('Server shutdown complete');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  
  server.close(() => {
    logger.info('HTTP server closed');
    
    // Close WebSocket connections
    wsService.close();
    
    // Cleanup services
    security.cleanup();
    
    logger.info('Server shutdown complete');
    process.exit(0);
  });
});

module.exports = { app, server, metrics, logger, security };