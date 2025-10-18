/**
 * Simplified PhantomPool API Server
 * Fixed version for immediate deployment
 */

import express, { Application, Request, Response, NextFunction } from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { WebSocketServer } from 'ws';

import { logger } from './utils/logger';
import { errorHandler } from './middleware/error.middleware';
import { authMiddleware } from './middleware/auth.middleware';

// Import routes
import { orderRoutes } from './routes/orders.routes';
import { healthRoutes } from './routes/health.routes';
import { adminRoutes } from './routes/admin.routes';
import { tradingRoutes } from './routes/trading.routes';
import { proofsRoutes } from './routes/proofs.routes';

// Import mock services
import { mockServices } from './services/mock.services';

interface ServerConfig {
  port: number;
  cors?: cors.CorsOptions;
  rateLimit?: {
    windowMs: number;
    max: number;
  };
}

export class PhantomPoolAPIServer {
  private app: Application;
  private server: http.Server | null = null;
  private wss: WebSocketServer | null = null;
  private services: any;

  constructor(private config: ServerConfig) {
    this.app = express();
    this.services = mockServices;
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: false, // Disable CSP for development
      crossOriginEmbedderPolicy: false,
    }));

    // CORS
    this.app.use(cors(this.config.cors || {
      origin: '*',
      credentials: true,
    }));

    // Rate limiting
    this.app.use(rateLimit(this.config.rateLimit || {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100,
    }));

    // Compression and parsing
    this.app.use(compression());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });
      next();
    });
  }

  private setupRoutes(): void {
    // Health check (no auth required)
    this.app.use('/api/health', healthRoutes(this.services));

    // API documentation
    this.app.get('/api/docs', (req: Request, res: Response) => {
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
        authentication: 'JWT Bearer token required for most endpoints',
        websocket: '/ws',
      });
    });

    // Protected routes
    this.app.use('/api/orders', orderRoutes(this.services));
    this.app.use('/api/trading', tradingRoutes(this.services));
    this.app.use('/api/proofs', proofsRoutes(this.services));
    this.app.use('/api/admin', adminRoutes(this.services));

    // WebSocket endpoint info
    this.app.get('/api/websocket', authMiddleware as any, (req: Request, res: Response) => {
      res.json({
        endpoint: '/ws',
        protocols: ['phantom-pool-v1'],
        authentication: 'Include JWT token in connection header',
        events: ['order_update', 'trade_execution', 'system_status'],
      });
    });

    // Root endpoint
    this.app.get('/', (req: Request, res: Response) => {
      res.json({
        message: 'PhantomPool API Server',
        version: '1.0.0',
        status: 'operational',
        documentation: '/api/docs',
        health: '/api/health',
        timestamp: new Date().toISOString(),
      });
    });

    // 404 handler
    this.app.use('*', (req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        path: req.path,
        method: req.method,
      });
    });
  }

  private setupErrorHandling(): void {
    this.app.use(errorHandler);

    // Uncaught exception handlers
    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught Exception:', error);
      this.gracefulShutdown();
    });

    process.on('unhandledRejection', (reason: any) => {
      logger.error('Unhandled Rejection:', reason);
      this.gracefulShutdown();
    });
  }

  private setupWebSocket(): void {
    if (!this.server) return;

    this.wss = new WebSocketServer({ 
      server: this.server,
      path: '/ws',
    });

    this.wss.on('connection', (ws, req) => {
      logger.info('WebSocket connection established', {
        ip: req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      });

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'welcome',
        message: 'Connected to PhantomPool WebSocket',
        timestamp: new Date().toISOString(),
      }));

      // Handle messages
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          logger.info('WebSocket message received', message);
          
          // Echo for now - in production, handle different message types
          ws.send(JSON.stringify({
            type: 'echo',
            data: message,
            timestamp: new Date().toISOString(),
          }));
        } catch (error) {
          logger.error('WebSocket message error:', error);
        }
      });

      ws.on('close', () => {
        logger.info('WebSocket connection closed');
      });

      ws.on('error', (error) => {
        logger.error('WebSocket error:', error);
      });
    });

    logger.info('WebSocket server setup complete');
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.config.port, () => {
          this.setupWebSocket();
          logger.info(`🚀 PhantomPool API Server started on port ${this.config.port}`);
          resolve();
        });

        this.server.on('error', (error: any) => {
          if (error.code === 'EADDRINUSE') {
            logger.error(`Port ${this.config.port} is already in use`);
          } else {
            logger.error('Server error:', error);
          }
          reject(error);
        });

      } catch (error) {
        logger.error('Failed to start server:', error);
        reject(error);
      }
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.wss) {
        this.wss.close();
        logger.info('WebSocket server closed');
      }

      if (this.server) {
        this.server.close(() => {
          logger.info('HTTP server closed');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  private async gracefulShutdown(): Promise<void> {
    logger.info('Shutting down gracefully...');
    await this.stop();
    process.exit(1);
  }

  // Getter for the Express app (useful for testing)
  getApp(): Application {
    return this.app;
  }

  // Set services (for dependency injection)
  setServices(services: any): void {
    this.services = services;
  }
}