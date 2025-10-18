/**
 * PhantomPool API Simple Launcher
 * Quick start version of the API server
 */

import { PhantomPoolAPIServer } from './api/server-simple.js';
import { mockServices } from './api/services/mock.services.js';
import { logger } from './api/utils/logger.js';

const PORT = parseInt(process.env.API_PORT || '8080');

async function startAPIServer() {
  try {
    logger.info('Starting PhantomPool API Server (Simple Version)...');

    // Initialize the API server
    const apiServer = new PhantomPoolAPIServer({
      port: PORT,
      cors: {
        origin: process.env.FRONTEND_URL?.split(',') || ['http://localhost:3000', 'http://localhost:3001'],
        credentials: true,
      },
      rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100,
      },
    });

    // Set services
    apiServer.setServices(mockServices);

    // Start the server
    await apiServer.start();

    logger.info(`🚀 PhantomPool API Server started successfully`);
    logger.info(`📡 Server running on http://localhost:${PORT}`);
    logger.info(`📊 Health check: http://localhost:${PORT}/api/health`);
    logger.info(`📚 API Documentation: http://localhost:${PORT}/api/docs`);
    logger.info(`🔒 WebSocket endpoint: ws://localhost:${PORT}/ws`);

    // Log environment info
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`Process ID: ${process.pid}`);
    logger.info(`Node.js Version: ${process.version}`);

    // Log available endpoints
    logger.info('Available API endpoints:', {
      health: '/api/health',
      orders: '/api/orders',
      trading: '/api/trading',
      proofs: '/api/proofs',
      admin: '/api/admin',
      docs: '/api/docs',
      websocket: '/ws',
    });

  } catch (error) {
    logger.error('Failed to start API server', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

// Start the server
if (require.main === module) {
  startAPIServer();
}

export { startAPIServer };