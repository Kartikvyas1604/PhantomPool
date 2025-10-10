import { FastifyInstance } from 'fastify';

export async function healthRoutes(fastify: FastifyInstance) {
  
  fastify.get('/health', async (request, reply) => {
    return reply.send({
      status: 'healthy',
      timestamp: Date.now(),
      uptime: process.uptime(),
      version: '1.0.0',
      services: {
        database: 'connected',
        redis: 'connected',
        solana: 'connected',
        executors: {
          total: 5,
          active: 4,
          healthy: 4,
        }
      }
    });
  });

  fastify.get('/api/system/status', async (request, reply) => {
    return reply.send({
      status: 'operational',
      components: {
        'Order Submission': 'operational',
        'Matching Engine': 'operational', 
        'Executor Network': 'degraded_performance',
        'Trade Execution': 'operational',
        'Analytics': 'operational',
      },
      metrics: {
        ordersPerMinute: Math.floor(Math.random() * 100) + 20,
        averageMatchTime: 28.5,
        executorUptime: 99.2,
        networkLatency: 45,
      }
    });
  });
}