/**
 * PhantomPool API Server
 * Simple Express.js server with all API endpoints
 */

const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { WebSocketServer } = require('ws');

// Mock data for demonstration
const mockOrders = [];
const mockTrades = [];

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
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: Math.floor(process.uptime()),
  });
});

app.get('/api/health/detailed', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      api: { status: 'healthy', uptime: Math.floor(process.uptime()) },
      database: { status: 'unknown', message: 'Mock implementation' },
      matching_engine: { status: 'healthy', active_orders: mockOrders.length },
    },
  });
});

// Orders endpoints
app.post('/api/orders', (req, res) => {
  const order = {
    id: `order_${Date.now()}`,
    ...req.body,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  mockOrders.push(order);
  
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

// Trading endpoints
app.get('/api/trading/orderbook/:token', (req, res) => {
  const { token } = req.params;
  res.json({
    success: true,
    data: {
      token,
      bids: [],
      asks: [],
      spread: '0.01',
      lastUpdate: new Date().toISOString(),
    },
  });
});

app.post('/api/trading/match', (req, res) => {
  const trade = {
    id: `trade_${Date.now()}`,
    ...req.body,
    timestamp: new Date().toISOString(),
    status: 'pending',
  };
  mockTrades.push(trade);
  
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

// Admin endpoints (simplified)
app.get('/api/admin/dashboard', (req, res) => {
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
      },
    },
  });
});

// API documentation
app.get('/api/docs', (req, res) => {
  res.json({
    name: 'PhantomPool API',
    version: '1.0.0',
    description: 'Dark pool trading API with privacy-preserving cryptography',
    endpoints: {
      health: '/api/health',
      orders: '/api/orders',
      trading: '/api/trading',
      proofs: '/api/proofs',
      admin: '/api/admin',
    },
    websocket: '/ws',
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'PhantomPool API Server',
    version: '1.0.0',
    status: 'operational',
    documentation: '/api/docs',
    healthCheck: '/api/health',
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use('*', (req, res) => {
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

// Setup WebSocket
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws, req) => {
  console.log(`[${new Date().toISOString()}] WebSocket connection established`);
  
  ws.send(JSON.stringify({
    type: 'welcome',
    message: 'Connected to PhantomPool WebSocket',
    timestamp: new Date().toISOString(),
  }));

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log('WebSocket message received:', message);
      
      ws.send(JSON.stringify({
        type: 'echo',
        data: message,
        timestamp: new Date().toISOString(),
      }));
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  });

  ws.on('close', () => {
    console.log(`[${new Date().toISOString()}] WebSocket connection closed`);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 PhantomPool API Server started successfully`);
  console.log(`📡 Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📚 API Documentation: http://localhost:${PORT}/api/docs`);
  console.log(`🔒 WebSocket endpoint: ws://localhost:${PORT}/ws`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Process ID: ${process.pid}`);
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

module.exports = { app, server };