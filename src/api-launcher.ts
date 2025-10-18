/**
 * PhantomPool API Launcher
 * Main entry point for the PhantomPool REST API server
 */

import { PhantomPoolAPIServer } from './api/server';
import { mockServices } from './api/services/mock.services';
import { logger } from './api/utils/logger';

const PORT = parseInt(process.env.API_PORT || '8080');
const HOST = process.env.API_HOST || '0.0.0.0';

async function startAPIServer() {
  try {
    logger.info('Starting PhantomPool API Server...');

    // Initialize the API server with mock services
    const apiServer = new PhantomPoolAPIServer({
      port: PORT,
      host: HOST,
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        credentials: true,
      },
      rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100,
      },
    });

    // Inject services
    apiServer.setServices(mockServices);

    // Start the server
    await apiServer.start();

    logger.info(`🚀 PhantomPool API Server started successfully`);
    logger.info(`📡 Server running on http://${HOST}:${PORT}`);
    logger.info(`📊 Health check: http://${HOST}:${PORT}/api/health`);
    logger.info(`📚 API Documentation: http://${HOST}:${PORT}/api/docs`);
    logger.info(`🔒 WebSocket endpoint: ws://${HOST}:${PORT}/ws`);

    // Log environment info
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`Process ID: ${process.pid}`);
    logger.info(`Node.js Version: ${process.version}`);

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

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
if (require.main === module) {
  startAPIServer();
}

export { startAPIServer };