import { FastifyInstance } from 'fastify';

export async function matchingRoutes(fastify: FastifyInstance) {
  
  fastify.get('/api/matching/status', async (request, reply) => {
    return reply.send({
      isMatching: false,
      nextRoundIn: 25,
      lastRound: {
        completedAt: Date.now() - 30000,
        matchedOrders: 5,
        clearingPrice: 152.45,
      },
    });
  });

  fastify.get('/api/matching/rounds/:roundNumber', async (request, reply) => {
    const { roundNumber } = request.params as { roundNumber: string };

    return reply.send({
      roundNumber: parseInt(roundNumber),
      tokenPair: 'SOL/USDC',
      startedAt: Date.now() - 45000,
      completedAt: Date.now() - 30000,
      orderCounts: {
        buy: 8,
        sell: 6,
        matched: 5,
      },
      clearingPrice: 152.45,
      totalVolume: 750,
      proofs: {
        vrf: { seed: 'seed123', output: 'output456' },
        shuffle: { permutation: [1, 3, 2, 4, 5] },
        matching: { proof: 'zkproof789' },
      },
    });
  });

  fastify.get('/api/matching/history', async (request, reply) => {
    const rounds = [];
    for (let i = 1; i <= 10; i++) {
      rounds.push({
        roundNumber: i,
        tokenPair: 'SOL/USDC',
        completedAt: Date.now() - (i * 60000),
        matchedCount: Math.floor(Math.random() * 10) + 1,
        clearingPrice: 150 + Math.random() * 10,
        totalVolume: Math.floor(Math.random() * 1000) + 100,
      });
    }

    return reply.send({ rounds });
  });
}