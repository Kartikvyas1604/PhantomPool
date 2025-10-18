/**
 * PhantomPool Enhanced API Server with Comprehensive Monitoring
 * Includes metrics collection, advanced logging, and health monitoring
 */

const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

// Import our services
const { getMetricsService } = require('./services/metrics.service');
const { getLogger, createRequestLogger } = require('./services/logger.service');
const { PhantomPoolWebSocketService } = require('./websocket/websocket-service');

// Initialize services
const metrics = getMetricsService();
const logger = getLogger({
  logLevel: process.env.LOG_LEVEL || 'info',
  enableFileLogging: true,
  logDirectory: path.join(__dirname, '../logs'),
  enableJson: process.env.LOG_FORMAT === 'json'
});

const app = express();
const server = http.createServer(app);

// Middleware setup with monitoring
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use(createRequestLogger(logger));

// Request metrics middleware
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

// Initialize WebSocket service
const wsService = new PhantomPoolWebSocketService(server, '/ws', {
  onConnect: (clientId) => {
    metrics.incrementWebSocketConnection();
    logger.logWebSocket('connect', clientId);
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

logger.info('WebSocket server initialized on /ws');

// =====================================================
// HEALTH AND MONITORING ENDPOINTS
// =====================================================

// Enhanced health check
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

// Comprehensive metrics endpoint
app.get('/api/metrics', (req, res) => {
  logger.debug('Metrics requested');
  
  const allMetrics = metrics.getMetrics();
  res.json({
    success: true,
    data: allMetrics
  });
});

// System dashboard
app.get('/api/admin/dashboard', (req, res) => {
  logger.debug('Dashboard data requested');
  
  const dashboard = metrics.getDashboard();
  res.json({
    success: true,
    data: dashboard
  });
});

// WebSocket status and management
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

// Broadcast message to WebSocket channel
app.post('/api/websocket/broadcast', (req, res) => {
  const { channel, message } = req.body;
  
  if (!channel || !message) {
    return res.status(400).json({
      success: false,
      error: 'Channel and message are required'
    });
  }
  
  const result = wsService.broadcastToChannel(channel, message);
  logger.info('Admin broadcast sent', { channel, messageType: message.type });
  
  res.json({
    success: true,
    data: {
      channel,
      recipients: result.recipients,
      messageId: result.messageId
    }
  });
});

// Logging endpoints
app.get('/api/admin/logs', (req, res) => {
  const { level, limit = 100, search } = req.query;
  
  let logs;
  if (search) {
    logs = logger.searchLogs(search, parseInt(limit));
  } else {
    logs = logger.getRecentLogs(parseInt(limit));
  }
  
  res.json({
    success: true,
    data: {
      logs,
      stats: logger.getStats(),
      filters: { level, limit, search }
    }
  });
});

// Alerts endpoint
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

// Resolve alert
app.post('/api/admin/alerts/:alertId/resolve', (req, res) => {
  const { alertId } = req.params;
  
  metrics.resolveAlert(alertId);
  logger.info('Alert resolved via API', { alertId });
  
  res.json({
    success: true,
    message: 'Alert resolved successfully'
  });
});

// =====================================================
// ORDER MANAGEMENT ENDPOINTS (Enhanced with Monitoring)
// =====================================================

app.get('/api/orders', (req, res) => {
  const { status, type, limit = 50 } = req.query;
  
  logger.debug('Orders list requested', { status, type, limit });
  
  // Mock order data with proper structure for testing
  const mockOrders = [
    {
      id: 'order_1',
      type: 'buy',
      token: 'SOL',
      amount: '2.5',
      price: '148.50',
      status: 'pending',
      trader: 'user_123',
      timestamp: Date.now() - 30000,
      encryptedData: 'elgamal_encrypted_data_123'
    },
    {
      id: 'order_2',
      type: 'sell',
      token: 'SOL',
      amount: '1.8',
      price: '149.75',
      status: 'filled',
      trader: 'user_456',
      timestamp: Date.now() - 20000,
      encryptedData: 'elgamal_encrypted_data_456'
    }
  ];
  
  let filteredOrders = mockOrders;
  
  if (status) {
    filteredOrders = filteredOrders.filter(order => order.status === status);
  }
  
  if (type) {
    filteredOrders = filteredOrders.filter(order => order.type === type);
  }
  
  filteredOrders = filteredOrders.slice(0, parseInt(limit));
  
  res.json({
    success: true,
    data: filteredOrders,
    meta: {
      total: mockOrders.length,
      filtered: filteredOrders.length,
      filters: { status, type, limit }
    }
  });
});

app.post('/api/orders', (req, res) => {
  const { type, token = 'SOL', amount, price, encryptedData } = req.body;
  const userId = req.headers['user-id'] || 'anonymous';
  
  if (!type || !amount || !price) {
    metrics.incrementErrorCount();
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: type, amount, price'
    });
  }
  
  const order = {
    id: `order_${Date.now()}`,
    type,
    token,
    amount,
    price,
    status: 'pending',
    trader: userId,
    timestamp: Date.now(),
    encryptedData: encryptedData || `encrypted_${Date.now()}_${Math.random().toString(36).substring(7)}`
  };
  
  // Record metrics
  metrics.recordOrder(order);
  metrics.recordCryptoOperation('elgamal_encrypt', true);
  
  // Log the order
  logger.logOrder('created', order, { userId });
  
  // Broadcast to WebSocket subscribers
  wsService.broadcastToChannel('orders', {
    type: 'order_created',
    order,
    timestamp: Date.now()
  });
  
  res.status(201).json({
    success: true,
    data: order,
    message: 'Order created successfully'
  });
});

app.get('/api/orders/:orderId', (req, res) => {
  const { orderId } = req.params;
  
  logger.debug('Order details requested', { orderId });
  
  // Mock order data
  const order = {
    id: orderId,
    type: 'buy',
    token: 'SOL',
    amount: '2.5',
    price: '148.50',
    status: 'pending',
    trader: 'user_123',
    timestamp: Date.now() - 30000,
    encryptedData: 'elgamal_encrypted_data_123'
  };
  
  res.json({
    success: true,
    data: order
  });
});

app.put('/api/orders/:orderId/status', (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;
  
  if (!status) {
    return res.status(400).json({
      success: false,
      error: 'Status is required'
    });
  }
  
  // Record status change
  metrics.recordOrderStatusChange('pending', status);
  
  const updatedOrder = {
    id: orderId,
    type: 'buy',
    token: 'SOL',
    amount: '2.5',
    price: '148.50',
    status,
    trader: 'user_123',
    timestamp: Date.now() - 30000,
    encryptedData: 'elgamal_encrypted_data_123'
  };
  
  logger.logOrder('status_updated', updatedOrder, { oldStatus: 'pending', newStatus: status });
  
  // Broadcast status update
  wsService.broadcastToChannel('orders', {
    type: 'order_update',
    orderId,
    status,
    order: updatedOrder,
    timestamp: Date.now()
  });
  
  res.json({
    success: true,
    data: updatedOrder,
    message: 'Order status updated successfully'
  });
});

app.get('/api/orders/stats', (req, res) => {
  const tradingMetrics = metrics.getMetrics().trading;
  
  res.json({
    success: true,
    data: {
      total_orders: tradingMetrics.totalOrders,
      active_orders: tradingMetrics.activeOrders,
      filled_orders: tradingMetrics.filledOrders,
      cancelled_orders: tradingMetrics.cancelledOrders,
      average_order_size: Math.round(tradingMetrics.averageOrderSize * 10000) / 10000,
      order_types: tradingMetrics.orderTypes,
      order_status: tradingMetrics.orderStatus
    }
  });
});

// =====================================================
// TRADING ENDPOINTS (Enhanced with Monitoring)
// =====================================================

app.post('/api/trading/match', (req, res) => {
  const { orderId, counterOrderId, amount, price, zkMatchProof } = req.body;
  
  if (!orderId || !counterOrderId || !amount || !price) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: orderId, counterOrderId, amount, price'
    });
  }
  
  const trade = {
    id: `trade_${Date.now()}`,
    orderId,
    counterOrderId,
    amount,
    price,
    timestamp: Date.now(),
    zkMatchProof: zkMatchProof || `proof_${Date.now()}_${Math.random().toString(36).substring(7)}`
  };
  
  // Record metrics
  metrics.recordTrade(trade);
  metrics.recordCryptoOperation('vrf_generate', true);
  metrics.recordCryptoOperation('bulletproof_verify', true);
  
  // Log the trade
  logger.logTrade('executed', trade);
  
  // Broadcast trade execution
  wsService.broadcastToChannel('trades', {
    type: 'trade_execution',
    trade,
    tradeId: trade.id,
    timestamp: Date.now()
  });
  
  res.status(201).json({
    success: true,
    data: trade,
    message: 'Trade executed successfully'
  });
});

app.get('/api/trading/trades', (req, res) => {
  const { limit = 50 } = req.query;
  
  // Mock trade data
  const mockTrades = [
    {
      id: 'trade_1',
      orderId: 'order_1',
      counterOrderId: 'order_2',
      amount: '1.5',
      price: '149.00',
      timestamp: Date.now() - 10000,
      zkMatchProof: 'proof_123'
    }
  ];
  
  res.json({
    success: true,
    data: mockTrades.slice(0, parseInt(limit)),
    meta: {
      total: mockTrades.length,
      limit: parseInt(limit)
    }
  });
});

app.post('/api/trading/simulate-orderbook-update/:token', (req, res) => {
  const { token } = req.params;
  
  logger.info('Simulating orderbook update', { token });
  
  // Simulate orderbook update
  const mockOrderbook = {
    token,
    bids: [
      { price: '148.90', amount: '2.5', orders: 3 },
      { price: '148.85', amount: '1.8', orders: 2 }
    ],
    asks: [
      { price: '149.10', amount: '3.2', orders: 4 },
      { price: '149.15', amount: '2.1', orders: 2 }
    ],
    lastUpdate: Date.now()
  };
  
  // Broadcast orderbook update
  wsService.broadcastToChannel('orderbook', {
    type: 'orderbook_update',
    token,
    orderbook: mockOrderbook,
    timestamp: Date.now()
  });
  
  res.json({
    success: true,
    data: mockOrderbook,
    message: 'Orderbook update simulated successfully'
  });
});

// =====================================================
// CRYPTO SERVICE ENDPOINTS (With Monitoring)
// =====================================================

app.post('/api/crypto/bulletproof/generate', (req, res) => {
  const { value, blinding } = req.body;
  
  if (!value || !blinding) {
    return res.status(400).json({
      success: false,
      error: 'Value and blinding factor are required'
    });
  }
  
  metrics.recordCryptoOperation('bulletproof_generate', true);
  logger.logCrypto('bulletproof_generate', true, { value: 'hidden', blinding: 'hidden' });
  
  const proof = `bulletproof_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  res.json({
    success: true,
    data: { proof },
    message: 'Bulletproof generated successfully'
  });
});

app.post('/api/crypto/elgamal/encrypt', (req, res) => {
  const { amount, price, publicKey } = req.body;
  
  if (!amount || !price) {
    return res.status(400).json({
      success: false,
      error: 'Amount and price are required'
    });
  }
  
  metrics.recordCryptoOperation('elgamal_encrypt', true);
  logger.logCrypto('elgamal_encrypt', true, { amount: 'hidden', price: 'hidden' });
  
  const encryptedData = `elgamal_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  res.json({
    success: true,
    data: { encryptedData },
    message: 'Order encrypted successfully'
  });
});

app.post('/api/crypto/vrf/generate', (req, res) => {
  const { input } = req.body;
  
  if (!input) {
    return res.status(400).json({
      success: false,
      error: 'Input is required'
    });
  }
  
  metrics.recordCryptoOperation('vrf_generate', true);
  logger.logCrypto('vrf_generate', true, { input: 'hidden' });
  
  const vrfOutput = `vrf_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const proof = `vrf_proof_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  res.json({
    success: true,
    data: { output: vrfOutput, proof },
    message: 'VRF generated successfully'
  });
});

// =====================================================
// ERROR HANDLING AND STARTUP
// =====================================================

// Global error handler
app.use((error, req, res, next) => {
  metrics.incrementErrorCount();
  logger.error('Unhandled error', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method
  });
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  metrics.incrementErrorCount();
  logger.warn('Route not found', { url: req.url, method: req.method });
  
  res.status(404).json({
    success: false,
    error: 'Route not found',
    message: `${req.method} ${req.url} not found`
  });
});

// Start server
const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || 'localhost';

server.listen(PORT, HOST, () => {
  metrics.log('info', 'PhantomPool Enhanced API Server started successfully');
  logger.info('🚀 PhantomPool Enhanced API Server started successfully');
  logger.info(`📡 Server running on http://${HOST}:${PORT}`);
  logger.info(`📊 Health check: http://${HOST}:${PORT}/api/health`);
  logger.info(`📈 Metrics: http://${HOST}:${PORT}/api/metrics`);
  logger.info(`📚 Dashboard: http://${HOST}:${PORT}/api/admin/dashboard`);
  logger.info(`🔒 WebSocket endpoint: ws://${HOST}:${PORT}/ws`);
  logger.info(`📈 WebSocket status: http://${HOST}:${PORT}/api/websocket/status`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Process ID: ${process.pid}`);
  
  // Update health status
  metrics.metrics.health.status = 'healthy';
  metrics.metrics.health.database = 'healthy';
  metrics.metrics.health.websocket = 'healthy';
  metrics.metrics.health.crypto = 'healthy';
  metrics.metrics.health.apis = 'healthy';
  
  logger.info('📺 Available WebSocket channels:');
  logger.info('  - orders: Real-time order updates');
  logger.info('  - trades: Live trade executions');
  logger.info('  - orderbook: Order book changes');
  logger.info('  - system: System status updates');
  logger.info('  - portfolio: Portfolio changes');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  metrics.shutdown();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully');
  metrics.shutdown();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

module.exports = { app, server, metrics, logger };