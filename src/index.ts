import Fastify from 'fastify';
import { ordersRoutes } from './api/routes/orders.routes';
import { matchingRoutes } from './api/routes/matching.routes';
import { analyticsRoutes } from './api/routes/analytics.routes';
import { healthRoutes } from './api/routes/health.routes';
import { Config } from './config/env.config';
import { logger } from './monitoring/logger.service';
import { MetricsService } from './monitoring/metrics.service';

async function bootstrap() {
  const fastify = Fastify({
    logger: false,
    trustProxy: true,
    bodyLimit: 1048576,
  });

  try {
    fastify.addHook('onRequest', async (request, reply) => {
      reply.header('Access-Control-Allow-Origin', '*');
      reply.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
      reply.header('Access-Control-Allow-Headers', 'Content-Type');
    });

    await ordersRoutes(fastify);
    await matchingRoutes(fastify);
    await analyticsRoutes(fastify);
    await healthRoutes(fastify);

    const metricsService = new MetricsService();
    await metricsService.start(9090);

    const port = Config.PORT || 3000;
    await fastify.listen({ port, host: '0.0.0.0' });
    
    logger.info(`PhantomPool API running on port ${port}`);
    logger.info(`Metrics available on port 9090`);
    
  } catch (err) {
    logger.error('Failed to start server:', { error: err });
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

bootstrap();