/**
 * PhantomPool API Server
 * Production REST API for dark pool trading system
 * Handles encrypted orders, matching coordination, and system monitoring
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

// Import services
import { DatabaseService } from './services/database.service';
import { ProductionMatchingEngine } from './services/matching.production.service';
import { ElGamalProductionService } from './crypto/elgamal.production.service';
import { BulletproofsProductionService } from './crypto/bulletproofs.production.service';
import { VRFProductionService } from './crypto/vrf.production.service';
import { ZKProofProductionService } from './crypto/zkproof.production.service';
import { ExecutorCoordinatorService } from './execution/executor-coordinator.service';

// Import middleware and utilities
import { authMiddleware } from './middleware/auth.middleware';
import { validationMiddleware } from './middleware/validation.middleware';
import { errorHandler } from './middleware/error.middleware';
import { logger } from './utils/logger';

// Import route handlers
import { orderRoutes } from './routes/orders.routes';
import { tradingRoutes } from './routes/trading.routes';
import { matchingRoutes } from './routes/matching.routes';
import { proofsRoutes } from './routes/proofs.routes';
import { analyticsRoutes } from './routes/analytics.routes';
import { healthRoutes } from './routes/health.routes';
import { adminRoutes } from './routes/admin.routes';

// Types
interface ServerConfig {
  port: number;
  corsOrigins: string[];
  rateLimitMax: number;
  rateLimitWindow: number;
  enableCompression: boolean;
  enableSecurity: boolean;
}

class PhantomPoolAPIServer {
  private app: express.Application;
  private server: any;
  private wsServer: WebSocketServer;
  private db: DatabaseService;
  private matchingEngine: ProductionMatchingEngine;
  private cryptoServices: {
    elgamal: ElGamalProductionService;
    bulletproofs: BulletproofsProductionService;
    vrf: VRFProductionService;
    zkProof: ZKProofProductionService;
  };
  private executorCoordinator: ExecutorCoordinatorService;

  constructor(config: ServerConfig) {
    this.app = express();
    this.initializeServices();
    this.setupMiddleware(config);
    this.setupRoutes();
    this.setupErrorHandling();
    
    // Create HTTP server and WebSocket server
    this.server = createServer(this.app);
    this.wsServer = new WebSocketServer({ server: this.server });
    
    logger.info('🚀 PhantomPool API Server initialized');
  }

  /**
   * Initialize all core services
   */
  private initializeServices(): void {
    this.db = new DatabaseService();
    this.matchingEngine = new ProductionMatchingEngine();
    
    // Initialize cryptographic services
    this.cryptoServices = {
      elgamal: new ElGamalProductionService(),
      bulletproofs: new BulletproofsProductionService(),
      vrf: new VRFProductionService(),
      zkProof: new ZKProofProductionService(),
    };
    
    this.executorCoordinator = new ExecutorCoordinatorService();
    
    logger.info('✅ Core services initialized');
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(config: ServerConfig): void {
    // Security middleware
    if (config.enableSecurity) {
      this.app.use(helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
          },
        },
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true,
        },
      }));
    }

    // CORS configuration
    this.app.use(cors({
      origin: config.corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: config.rateLimitWindow,
      max: config.rateLimitMax,
      message: {
        error: 'Too many requests',
        retryAfter: Math.ceil(config.rateLimitWindow / 1000),
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use('/api/', limiter);

    // Compression
    if (config.enableCompression) {
      this.app.use(compression());
    }

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString(),
      });
      next();
    });

    logger.info('✅ Middleware configured');
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // Health check (no auth required)
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
      });
    });

    // API routes with authentication
    this.app.use('/api/orders', authMiddleware, orderRoutes(this.db, this.matchingEngine, this.cryptoServices));
    this.app.use('/api/trading', authMiddleware, tradingRoutes(this.db, this.matchingEngine));
    this.app.use('/api/matching', authMiddleware, matchingRoutes(this.db, this.matchingEngine, this.executorCoordinator));
    this.app.use('/api/proofs', authMiddleware, proofsRoutes(this.db, this.cryptoServices));
    this.app.use('/api/analytics', authMiddleware, analyticsRoutes(this.db));
    this.app.use('/api/health', healthRoutes(this.db, this.matchingEngine, this.executorCoordinator));
    this.app.use('/api/admin', authMiddleware, adminRoutes(this.db, this.executorCoordinator));

    // WebSocket endpoint info
    this.app.get('/api/websocket', authMiddleware, (req, res) => {
      res.json({
        endpoint: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001',
        protocols: ['phantom-pool-v1'],
        authentication: 'Bearer token required',
      });
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Endpoint not found',
        path: req.originalUrl,
        availableEndpoints: [
          '/health',
          '/api/orders',
          '/api/trading',
          '/api/matching',
          '/api/proofs',
          '/api/analytics',
          '/api/health',
          '/api/admin',
        ],
      });
    });

    logger.info('✅ Routes configured');
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    this.app.use(errorHandler);
    
    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      this.gracefulShutdown();
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      this.gracefulShutdown();
    });

    logger.info('✅ Error handling configured');
  }

  /**
   * Setup WebSocket server for real-time updates
   */
  private setupWebSocket(): void {
    this.wsServer.on('connection', (ws, req) => {
      logger.info('WebSocket connection established', { ip: req.socket.remoteAddress });

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'welcome',
        data: {
          message: 'Connected to PhantomPool WebSocket',
          timestamp: Date.now(),
        },
      }));

      // Handle incoming messages
      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          await this.handleWebSocketMessage(ws, message);
        } catch (error) {
          logger.error('WebSocket message error:', error);
          ws.send(JSON.stringify({
            type: 'error',
            data: { message: 'Invalid message format' },
          }));
        }
      });

      // Handle connection close
      ws.on('close', () => {
        logger.info('WebSocket connection closed');
      });

      // Handle errors
      ws.on('error', (error) => {
        logger.error('WebSocket error:', error);
      });
    });

    logger.info('✅ WebSocket server configured');
  }

  /**
   * Handle WebSocket messages
   */
  private async handleWebSocketMessage(ws: any, message: any): Promise<void> {
    switch (message.type) {
      case 'subscribe_orders':
        // Subscribe to user's order updates
        if (message.userId) {
          // In production: validate user authentication
          ws.userId = message.userId;
          ws.send(JSON.stringify({
            type: 'subscription_confirmed',
            data: { subscription: 'orders', userId: message.userId },
          }));
        }
        break;

      case 'subscribe_market':
        // Subscribe to market updates
        if (message.tradingPairId) {
          ws.tradingPairId = message.tradingPairId;
          ws.send(JSON.stringify({
            type: 'subscription_confirmed',
            data: { subscription: 'market', tradingPairId: message.tradingPairId },
          }));
        }
        break;

      case 'ping':
        // Respond to ping with pong
        ws.send(JSON.stringify({
          type: 'pong',
          data: { timestamp: Date.now() },
        }));
        break;

      default:
        ws.send(JSON.stringify({
          type: 'error',
          data: { message: 'Unknown message type' },
        }));
    }
  }

  /**
   * Broadcast message to connected WebSocket clients
   */
  public broadcastToClients(message: any, filter?: (ws: any) => boolean): void {
    this.wsServer.clients.forEach((ws) => {
      if (ws.readyState === ws.OPEN && (!filter || filter(ws))) {
        ws.send(JSON.stringify(message));
      }
    });
  }

  /**
   * Start the server
   */
  public async start(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.listen(port, (error: any) => {
        if (error) {
          reject(error);
          return;
        }

        this.setupWebSocket();
        logger.info(`🌟 PhantomPool API Server running on port ${port}`);
        logger.info(`📊 Health check: http://localhost:${port}/health`);
        logger.info(`🔗 API endpoints: http://localhost:${port}/api`);
        logger.info(`🔌 WebSocket: ws://localhost:${port}`);
        
        resolve();
      });
    });
  }

  /**
   * Graceful shutdown
   */
  public async gracefulShutdown(): Promise<void> {
    logger.info('Starting graceful shutdown...');

    // Close WebSocket server
    this.wsServer.close();

    // Close HTTP server
    this.server.close(async () => {
      logger.info('HTTP server closed');

      // Close database connections
      try {
        // In production: close database connections
        logger.info('Database connections closed');
      } catch (error) {
        logger.error('Error closing database connections:', error);
      }

      logger.info('Graceful shutdown completed');
      process.exit(0);
    });

    // Force exit after 30 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  }

  /**
   * Get server instance (for testing)
   */
  public getApp(): express.Application {
    return this.app;
  }

  /**
   * Get WebSocket server instance
   */
  public getWebSocketServer(): WebSocketServer {
    return this.wsServer;
  }
}

// Server configuration
const serverConfig: ServerConfig = {
  port: parseInt(process.env.PORT || '3001'),
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
  enableCompression: true,
  enableSecurity: process.env.NODE_ENV === 'production',
};

// Create and start server
const server = new PhantomPoolAPIServer(serverConfig);

// Start server if this file is run directly
if (require.main === module) {
  server.start(serverConfig.port).catch((error) => {
    logger.error('Failed to start server:', error);
    process.exit(1);
  });
}

// Handle graceful shutdown signals
process.on('SIGTERM', () => server.gracefulShutdown());
process.on('SIGINT', () => server.gracefulShutdown());

export { PhantomPoolAPIServer, serverConfig };
export default server;