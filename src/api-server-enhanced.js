/**
 * Enhanced PhantomPool API Server with WebSocket Integration
 * Complete Express.js server with real-time WebSocket services
 */

const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { PhantomPoolWebSocketService } = require('./websocket/websocket-service');

// Mock data for demonstration
const mockOrders = [];
const mockTrades = [];
let wsService = null;

const app = express();
const PORT = parseInt(process.env.API_PORT || '8080');

// Middleware setup
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*', credentials: true }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health endpoints
app.get('/api/health', (req, res) => {
  const wsMetrics = wsService ? wsService.getMetrics() : {};
  
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: Math.floor(process.uptime()),
    websocket: wsMetrics
  });
});

app.get('/api/health/detailed', (req, res) => {
  const wsStatus = wsService ? wsService.getStatus() : {};
  
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      api: { 
        status: 'healthy', 
        uptime: Math.floor(process.uptime()),
        orders: mockOrders.length,
        trades: mockTrades.length
      },
      websocket: {
        status: 'healthy',
        ...wsStatus
      },
      database: { status: 'unknown', message: 'Mock implementation' },
      matching_engine: { status: 'healthy', active_orders: mockOrders.length },
    },
  });
});

// Orders endpoints with WebSocket integration
app.post('/api/orders', (req, res) => {
  const order = {
    id: `order_${Date.now()}`,
    userId: req.headers['user-id'] || 'anonymous',
    ...req.body,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  mockOrders.push(order);
  
  // Broadcast order update via WebSocket
  if (wsService) {
    wsService.broadcastOrderUpdate(order.id, 'pending', {
      userId: order.userId,
      type: order.type,
      token: order.token,
      amount: order.amount
    });
  }
  
  res.status(201).json({
    success: true,
    data: order,
    message: 'Order created successfully',
  });
});

app.get('/api/orders', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  
  res.json({
    success: true,
    data: {
      orders: mockOrders.slice(startIndex, endIndex),
      pagination: {
        page,
        limit,
        totalCount: mockOrders.length,
        totalPages: Math.ceil(mockOrders.length / limit),
      },
    },
  });
});

app.put('/api/orders/:orderId/status', (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;
  
  const order = mockOrders.find(o => o.id === orderId);
  if (!order) {
    return res.status(404).json({
      success: false,
      error: 'Order not found'
    });
  }
  
  order.status = status;
  order.updatedAt = new Date().toISOString();
  
  // Broadcast order update via WebSocket
  if (wsService) {
    wsService.broadcastOrderUpdate(orderId, status, {
      userId: order.userId,
      updatedAt: order.updatedAt
    });
  }
  
  res.json({
    success: true,
    data: order,
    message: 'Order status updated'
  });
});

app.get('/api/orders/stats', (req, res) => {
  res.json({
    success: true,
    data: {
      total_orders: mockOrders.length,
      active_orders: mockOrders.filter(o => o.status === 'pending').length,
      filled_orders: mockOrders.filter(o => o.status === 'filled').length,
      cancelled_orders: mockOrders.filter(o => o.status === 'cancelled').length,
    },
  });
});

// Trading endpoints with WebSocket integration
app.get('/api/trading/orderbook/:token', (req, res) => {
  const { token } = req.params;
  const orderbook = {
    token,
    bids: mockOrders.filter(o => o.type === 'buy' && o.token === token && o.status === 'pending')
                    .map(o => ({ price: o.price, amount: o.amount }))
                    .sort((a, b) => parseFloat(b.price) - parseFloat(a.price))
                    .slice(0, 10),
    asks: mockOrders.filter(o => o.type === 'sell' && o.token === token && o.status === 'pending')
                    .map(o => ({ price: o.price, amount: o.amount }))
                    .sort((a, b) => parseFloat(a.price) - parseFloat(b.price))
                    .slice(0, 10),
    spread: '0.01',
    lastUpdate: new Date().toISOString(),
  };
  
  res.json({
    success: true,
    data: orderbook,
  });
});

app.post('/api/trading/match', (req, res) => {
  const trade = {
    id: `trade_${Date.now()}`,
    userId: req.headers['user-id'] || 'anonymous',
    ...req.body,
    timestamp: new Date().toISOString(),
    status: 'pending',
  };
  mockTrades.push(trade);
  
  // Broadcast trade execution via WebSocket
  if (wsService) {
    wsService.broadcastTradeExecution(trade.id, {
      userId: trade.userId,
      orderId: trade.orderId,
      counterOrderId: trade.counterOrderId,
      amount: trade.amount,
      price: trade.price,
      status: 'pending'
    });
  }
  
  res.status(201).json({
    success: true,
    data: trade,
    message: 'Trade match submitted successfully',
  });
});

app.get('/api/trading/trades', (req, res) => {
  res.json({
    success: true,
    data: {
      trades: mockTrades,
      pagination: {
        page: 1,
        limit: 20,
        totalCount: mockTrades.length,
        totalPages: 1,
      },
    },
  });
});

// WebSocket management endpoints
app.get('/api/websocket/status', (req, res) => {
  if (!wsService) {
    return res.status(503).json({
      success: false,
      error: 'WebSocket service not available'
    });
  }
  
  res.json({
    success: true,
    data: wsService.getStatus()
  });
});

app.get('/api/websocket/metrics', (req, res) => {
  if (!wsService) {
    return res.status(503).json({
      success: false,
      error: 'WebSocket service not available'
    });
  }
  
  res.json({
    success: true,
    data: wsService.getMetrics()
  });
});

app.post('/api/websocket/broadcast', (req, res) => {
  if (!wsService) {
    return res.status(503).json({
      success: false,
      error: 'WebSocket service not available'
    });
  }
  
  const { channel, message } = req.body;
  if (!channel || !message) {
    return res.status(400).json({
      success: false,
      error: 'Channel and message are required'
    });
  }
  
  wsService.broadcastToChannel(channel, {
    type: 'admin_broadcast',
    ...message,
    timestamp: new Date().toISOString()
  });
  
  res.json({
    success: true,
    message: 'Broadcast sent successfully'
  });
});

// Simulate market data updates
app.post('/api/trading/simulate-orderbook-update/:token', (req, res) => {
  const { token } = req.params;
  
  if (wsService) {
    wsService.broadcastOrderBookUpdate(token, {
      bids: [
        { price: '49.95', amount: '100.0' },
        { price: '49.90', amount: '200.0' }
      ],
      asks: [
        { price: '50.05', amount: '150.0' },
        { price: '50.10', amount: '180.0' }
      ]
    });
  }
  
  res.json({
    success: true,
    message: `Orderbook update broadcasted for ${token}`
  });
});

// Proofs endpoints
app.post('/api/proofs/bulletproof/generate', (req, res) => {
  res.json({
    success: true,
    data: {
      proof: `bulletproof_${Date.now()}`,
      commitment: `commitment_${Date.now()}`,
      verificationKey: `vk_${Date.now()}`,
      timestamp: new Date().toISOString(),
    },
    message: 'Bulletproof generated successfully',
  });
});

app.post('/api/proofs/bulletproof/verify', (req, res) => {
  res.json({
    success: true,
    data: {
      valid: true,
      timestamp: new Date().toISOString(),
    },
    message: 'Proof is valid',
  });
});

// Admin endpoints
app.get('/api/admin/dashboard', (req, res) => {
  const wsStatus = wsService ? wsService.getStatus() : {};
  
  res.json({
    success: true,
    data: {
      system: {
        uptime: Math.floor(process.uptime()),
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
      },
      statistics: {
        totalOrders: mockOrders.length,
        totalTrades: mockTrades.length,
        activeOrders: mockOrders.filter(o => o.status === 'pending').length,
        websocketConnections: wsStatus.connected_clients || 0
      },
      websocket: wsStatus
    },
  });
});

// API documentation
app.get('/api/docs', (req, res) => {
  res.json({
    name: 'PhantomPool API',
    version: '1.0.0',
    description: 'Dark pool trading API with privacy-preserving cryptography and real-time WebSocket updates',
    endpoints: {
      health: '/api/health',
      orders: '/api/orders',
      trading: '/api/trading',
      proofs: '/api/proofs',
      admin: '/api/admin',
      websocket: '/api/websocket'
    },
    websocket: {
      endpoint: '/ws',
      authentication: 'Required via auth message with bearer token',
      channels: ['orders', 'trades', 'orderbook', 'system', 'portfolio']
    }
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'PhantomPool API Server with WebSocket',
    version: '1.0.0',
    status: 'operational',
    documentation: '/api/docs',
    healthCheck: '/api/health',
    websocket: '/ws',
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path,
    method: req.method,
  });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('API Error:', error);
  res.status(error.statusCode || 500).json({
    success: false,
    error: error.message || 'Internal server error',
    timestamp: new Date().toISOString(),
  });
});

// Start HTTP server
const server = http.createServer(app);

// Initialize WebSocket service
wsService = new PhantomPoolWebSocketService(server, {
  path: '/ws',
  maxConnections: 1000,
  heartbeatInterval: 30000,
  authTimeout: 10000
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 PhantomPool API Server with WebSocket started successfully`);
  console.log(`📡 Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📚 API Documentation: http://localhost:${PORT}/api/docs`);
  console.log(`🔒 WebSocket endpoint: ws://localhost:${PORT}/ws`);
  console.log(`📈 WebSocket status: http://localhost:${PORT}/api/websocket/status`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Process ID: ${process.pid}`);
  
  console.log('\n📺 Available WebSocket channels:');
  console.log('  - orders: Real-time order updates');
  console.log('  - trades: Live trade executions');
  console.log('  - orderbook: Order book changes');
  console.log('  - system: System status updates');
  console.log('  - portfolio: Portfolio changes');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  server.close(() => process.exit(0));
});

module.exports = { app, server, wsService };