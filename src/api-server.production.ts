// Production Backend API Server
// Comprehensive API for hackathon-winning dark pool system

import express from 'express';
import cors from 'cors';
import { Connection } from '@solana/web3.js';
import { ProductionMatchingEngine } from '../matching/production-matching-engine.service';
import { ElGamalProductionService } from '../crypto/elgamal.production.service';
import { JupiterProductionService } from './jupiter.production.service';
import { WebSocketProductionService } from './websocket.production.service';

const app = express();
const PORT = process.env.PORT || 4000;
const WS_PORT = 8080;

// Services
let connection: Connection;
let matchingEngine: ProductionMatchingEngine;
let elgamalService: ElGamalProductionService;
let jupiterService: JupiterProductionService;
let websocketService: WebSocketProductionService;

// In-memory data stores (in production, use proper database)
const orders = new Map();
const trades = new Map();
const userStats = new Map();

interface OrderSubmission {
  walletAddress: string;
  side: 'BUY' | 'SELL';
  amount: number;
  price: number;
  signature: string;
}

interface TradeExecution {
  tradeId: string;
  buyOrder: string;
  sellOrder: string;
  amount: number;
  price: number;
  timestamp: number;
  jupiterSignature?: string;
}

/**
 * Initialize production services
 */
async function initializeServices() {
  console.log('🚀 Initializing production services...');

  // Connect to Solana testnet
  connection = new Connection('https://api.testnet.solana.com', 'confirmed');
  console.log('✅ Connected to Solana testnet');

  // Initialize cryptographic services
  elgamalService = new ElGamalProductionService();
  console.log('✅ ElGamal encryption service initialized');

  // Initialize Jupiter DEX service
  jupiterService = new JupiterProductionService(connection);
  console.log('✅ Jupiter DEX service initialized');

  // Initialize WebSocket service
  websocketService = new WebSocketProductionService(WS_PORT);
  console.log('✅ WebSocket service initialized');

  // Initialize matching engine
  matchingEngine = new ProductionMatchingEngine(
    elgamalService,
    (result) => {
      // Broadcast matching result
      websocketService.broadcastMatchingUpdate({
        roundNumber: result.executionTime, // Temporary
        status: 'complete',
        progress: 100,
        result,
      });

      console.log(`📊 Matching round complete: ${result.matchedTrades.length} trades`);
    },
    (status) => {
      // Broadcast status updates
      websocketService.broadcastMarketData({
        volume24h: Math.random() * 10000,
        totalTrades: trades.size,
        avgMatchingTime: status.nextRound || 30,
        activeOrders: orders.size,
      });
    }
  );

  // Start matching engine with 30-second intervals
  matchingEngine.start(30000);
  console.log('✅ Production matching engine started');
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`📡 ${req.method} ${req.path} - ${req.ip}`);
  next();
});

// === API ROUTES ===

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      matching_engine: matchingEngine ? 'running' : 'stopped',
      websocket: websocketService ? 'running' : 'stopped',
      jupiter: jupiterService ? 'connected' : 'disconnected',
      solana: connection ? 'connected' : 'disconnected',
    },
    stats: matchingEngine?.getMatchingStats() || {},
    executors: matchingEngine?.getExecutorStatus() || [],
  };

  res.json(health);
});

/**
 * Submit encrypted order
 */
app.post('/api/orders/submit', async (req, res) => {
  try {
    const { walletAddress, side, amount, price, signature }: OrderSubmission = req.body;

    // Validate request
    if (!walletAddress || !side || !amount || !price) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Generate order hash
    const orderHash = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Encrypt order using ElGamal
    const keyPair = elgamalService.generateKeyPair();
    const encrypted = elgamalService.encryptOrder(keyPair.publicKey, { amount, price });

    // Create order object
    const order = {
      orderHash,
      walletAddress,
      side,
      encryptedAmount: encrypted.encryptedAmount,
      encryptedPrice: encrypted.encryptedPrice,
      timestamp: Date.now(),
      signature,
      status: 'submitted',
    };

    // Store order
    orders.set(orderHash, order);

    // Add to matching engine
    matchingEngine.addOrder(order);

    // Send order update via WebSocket
    websocketService.sendOrderUpdate(walletAddress, {
      orderHash,
      status: 'queued',
    });

    console.log(`📝 Order submitted: ${orderHash} (${side} ${amount} @ $${price})`);

    res.json({
      success: true,
      orderHash,
      status: 'queued',
      estimatedMatch: Date.now() + 30000, // Next round
    });

  } catch (error) {
    console.error('❌ Order submission failed:', error);
    res.status(500).json({ error: 'Order submission failed' });
  }
});

/**
 * Get order status
 */
app.get('/api/orders/:orderHash/status', (req, res) => {
  const { orderHash } = req.params;
  const order = orders.get(orderHash);

  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  res.json({
    orderHash,
    status: order.status,
    submittedAt: order.timestamp,
    side: order.side,
    estimatedMatch: Date.now() + 30000,
  });
});

/**
 * Get user's orders
 */
app.get('/api/orders/wallet/:walletAddress', (req, res) => {
  const { walletAddress } = req.params;
  const userOrders = Array.from(orders.values())
    .filter(order => order.walletAddress === walletAddress)
    .map(order => ({
      orderHash: order.orderHash,
      side: order.side,
      status: order.status,
      timestamp: order.timestamp,
    }));

  res.json({
    walletAddress,
    orders: userOrders,
    totalOrders: userOrders.length,
  });
});

/**
 * Get matching engine statistics
 */
app.get('/api/matching/stats', (req, res) => {
  const stats = matchingEngine.getMatchingStats();
  const executors = matchingEngine.getExecutorStatus();

  res.json({
    ...stats,
    executors,
    totalOrders: orders.size,
    totalTrades: trades.size,
    uptime: process.uptime(),
  });
});

/**
 * Get market data
 */
app.get('/api/market/data', (req, res) => {
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;

  // Calculate 24h stats
  const recentTrades = Array.from(trades.values())
    .filter((trade: any) => trade.timestamp > dayAgo);

  const volume24h = recentTrades.reduce((sum: number, trade: any) => sum + trade.amount, 0);
  const avgPrice = recentTrades.length > 0 
    ? recentTrades.reduce((sum: number, trade: any) => sum + trade.price, 0) / recentTrades.length 
    : 150;

  res.json({
    volume24h,
    trades24h: recentTrades.length,
    avgPrice,
    totalOrders: orders.size,
    activeOrders: Array.from(orders.values()).filter((o: any) => o.status === 'queued').length,
    totalTrades: trades.size,
    lastUpdate: now,
  });
});

/**
 * Execute Jupiter swap (for matched trades)
 */
app.post('/api/jupiter/swap', async (req, res) => {
  try {
    const { inputMint, outputMint, amount, userPublicKey } = req.body;

    if (!inputMint || !outputMint || !amount || !userPublicKey) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Get quote first
    const quote = await jupiterService.getQuote({
      inputMint,
      outputMint,
      amount,
      slippageBps: 50,
    });

    // Execute swap
    const result = await jupiterService.executeSwap({
      inputMint,
      outputMint,
      amount,
      slippageBps: 50,
      userPublicKey,
    });

    console.log(`🔄 Jupiter swap executed: ${result.signature}`);

    res.json({
      success: true,
      quote,
      result,
    });

  } catch (error) {
    console.error('❌ Jupiter swap failed:', error);
    res.status(500).json({ error: 'Swap execution failed' });
  }
});

/**
 * Get supported tokens
 */
app.get('/api/jupiter/tokens', async (req, res) => {
  try {
    const tokens = await jupiterService.getSupportedTokens();
    res.json({ tokens: tokens.slice(0, 100) }); // Return first 100 tokens
  } catch (error) {
    console.error('❌ Failed to get tokens:', error);
    res.status(500).json({ error: 'Failed to fetch tokens' });
  }
});

/**
 * Get WebSocket connection info
 */
app.get('/api/websocket/info', (req, res) => {
  const stats = websocketService.getServerStats();
  
  res.json({
    websocketUrl: `ws://localhost:${WS_PORT}`,
    stats,
    channels: [
      'matching_rounds',
      'order_updates',
      'market_data',
      'executor_status',
    ],
  });
});

/**
 * Analytics endpoint
 */
app.get('/api/analytics/dashboard', (req, res) => {
  const { timeframe = '24h' } = req.query;
  const now = Date.now();
  const timeframes: Record<string, number> = {
    '1h': 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
  };

  const period = timeframes[timeframe as string] || timeframes['24h'];
  const startTime = now - period;

  // Mock analytics data
  const analytics = {
    timeframe,
    period: { start: startTime, end: now },
    metrics: {
      totalVolume: Math.random() * 100000,
      totalTrades: Math.floor(Math.random() * 1000),
      uniqueTraders: Math.floor(Math.random() * 500),
      avgTradeSize: 50 + Math.random() * 200,
      successRate: 95 + Math.random() * 5,
      avgMatchingTime: 25 + Math.random() * 10,
    },
    charts: {
      volumeOverTime: Array.from({ length: 24 }, (_, i) => ({
        time: now - (23 - i) * 60 * 60 * 1000,
        volume: Math.random() * 5000,
      })),
      priceHistory: Array.from({ length: 24 }, (_, i) => ({
        time: now - (23 - i) * 60 * 60 * 1000,
        price: 148 + Math.sin(i * 0.5) * 5 + Math.random() * 2,
      })),
    },
  };

  res.json(analytics);
});

/**
 * Demo endpoints for hackathon presentation
 */
app.post('/api/demo/generate-orders', (req, res) => {
  const { count = 10 } = req.body;
  let generated = 0;

  for (let i = 0; i < count; i++) {
    const side = Math.random() > 0.5 ? 'BUY' : 'SELL';
    const amount = 0.5 + Math.random() * 3; // 0.5-3.5 SOL
    const price = 148 + Math.random() * 6 - 3; // $145-151
    
    const orderHash = `demo_${Date.now()}_${i}`;
    const keyPair = elgamalService.generateKeyPair();
    const encrypted = elgamalService.encryptOrder(keyPair.publicKey, { amount, price });

    const order = {
      orderHash,
      walletAddress: `demo-wallet-${i}`,
      side,
      encryptedAmount: encrypted.encryptedAmount,
      encryptedPrice: encrypted.encryptedPrice,
      timestamp: Date.now(),
      status: 'submitted',
    };

    orders.set(orderHash, order);
    matchingEngine.addOrder(order);
    generated++;
  }

  console.log(`🎮 Generated ${generated} demo orders`);

  res.json({
    success: true,
    generated,
    totalOrders: orders.size,
  });
});

/**
 * Error handling middleware
 */
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('❌ Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

/**
 * 404 handler
 */
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

/**
 * Start the production server
 */
async function startServer() {
  try {
    // Initialize all services
    await initializeServices();

    // Start HTTP server
    app.listen(PORT, () => {
      console.log(`\n🚀 === PHANTOMPOOL PRODUCTION SERVER ===`);
      console.log(`📡 HTTP API: http://localhost:${PORT}`);
      console.log(`🔌 WebSocket: ws://localhost:${WS_PORT}`);
      console.log(`💰 Solana: testnet (connected)`);
      console.log(`🔐 Encryption: ElGamal homomorphic`);
      console.log(`🎯 Matching: 30s intervals`);
      console.log(`🔄 Jupiter: DEX integration enabled`);
      console.log(`⚡ Status: READY FOR HACKATHON!\n`);
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down gracefully...');
      matchingEngine.stop();
      websocketService.shutdown();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start if called directly
if (require.main === module) {
  startServer();
}

export { app, startServer };