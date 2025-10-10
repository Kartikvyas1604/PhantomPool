import { FastifyInstance } from 'fastify';
import { generateOrderHash as createOrderHash } from '../../utils/encoding.utils';

export async function ordersRoutes(fastify: FastifyInstance) {
  
  fastify.post('/api/orders/submit', async (request, reply) => {
    const {
      walletAddress,
      tokenPair,
      side,
      amount,
      limitPrice,
      balance,
      signature,
    } = request.body as {
      walletAddress: string;
      tokenPair: string;
      side: 'BUY' | 'SELL';
      amount: number;
      limitPrice: number;
      balance: number;
      signature: string;
    };

    try {
      const orderHash = createOrderHash();
      const timestamp = Date.now();

      const encryptedOrder = {
        orderHash,
        walletAddress,
        tokenPair,
        side,
        encryptedAmount: await encryptValue(amount),
        encryptedPrice: await encryptValue(limitPrice),
        timestamp,
        signature,
      };

      return reply.code(201).send({
        success: true,
        orderHash,
        encryptedOrder,
        estimatedMatchTime: 30,
      });

    } catch (error) {
      return reply.code(500).send({
        error: 'Failed to submit order',
        message: (error as Error).message,
      });
    }
  });

  fastify.get('/api/orders/:orderHash', async (request, reply) => {
    const { orderHash } = request.params as { orderHash: string };

    return reply.send({
      orderHash,
      status: 'PENDING',
      submittedAt: Date.now(),
      estimatedMatchTime: 25,
    });
  });

  fastify.get('/api/orders/book/:tokenPair', async (request, reply) => {
    const { tokenPair } = request.params as { tokenPair: string };

    return reply.send({
      tokenPair,
      buyOrders: 3,
      sellOrders: 2,
      orders: [
        {
          orderHash: 'hash1',
          side: 'BUY',
          timestamp: Date.now() - 10000,
          encryptedAmount: { C1: { x: 'enc1', y: 'enc2' }, C2: { x: 'enc3', y: 'enc4' } },
          encryptedPrice: { C1: { x: 'enc5', y: 'enc6' }, C2: { x: 'enc7', y: 'enc8' } },
        },
      ],
    });
  });

  fastify.delete('/api/orders/:orderHash', async (request, reply) => {
    const { orderHash } = request.params as { orderHash: string };

    return reply.send({
      success: true,
      message: 'Order cancelled',
    });
  });

  fastify.get('/api/orders/wallet/:walletAddress', async (request, reply) => {
    const { walletAddress } = request.params as { walletAddress: string };
    const { limit = 50 } = request.query as { limit?: number };

    return reply.send({
      orders: [],
      count: 0,
    });
  });
}

async function encryptValue(_value: number) {
  return {
    C1: { 
      x: Math.random().toString(36).substring(2, 15), 
      y: Math.random().toString(36).substring(2, 15) 
    },
    C2: { 
      x: Math.random().toString(36).substring(2, 15), 
      y: Math.random().toString(36).substring(2, 15) 
    }
  };
}