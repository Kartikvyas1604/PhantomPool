import { FastifyInstance } from 'fastify';

export async function analyticsRoutes(fastify: FastifyInstance) {
  
  fastify.get('/api/analytics/volume', async (request, reply) => {
    return reply.send({
      timeframe: '24h',
      totalVolume: 125450.75,
      tradeCount: 238,
      averagePrice: 152.34,
      startTime: Date.now() - 86400000,
      endTime: Date.now(),
    });
  });

  fastify.get('/api/analytics/price-history', async (request, reply) => {
    const data = [];
    for (let i = 0; i < 24; i++) {
      data.push({
        timestamp: Date.now() - ((24 - i) * 3600000),
        price: 150 + Math.random() * 10,
        volume: Math.floor(Math.random() * 1000) + 100,
      });
    }

    return reply.send({
      tokenPair: 'SOL/USDC',
      interval: '1h',
      data,
    });
  });

  fastify.get('/api/analytics/executors', async (request, reply) => {
    const executors = [];
    for (let i = 1; i <= 5; i++) {
      executors.push({
        executorId: i,
        isActive: Math.random() > 0.1,
        lastHeartbeat: Date.now() - Math.floor(Math.random() * 30000),
        uptime: Math.floor(Math.random() * 86400),
        totalDecryptions: Math.floor(Math.random() * 1000) + 100,
        totalSignatures: Math.floor(Math.random() * 500) + 50,
      });
    }

    return reply.send({
      executors,
      activeCount: executors.filter(e => e.isActive).length,
      totalCount: 5,
    });
  });
}