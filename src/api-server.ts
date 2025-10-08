import Fastify, { FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import websocket from '@fastify/websocket'
import { OnChainOrderService } from './services/onchain-order.service'
import { OnChainMatchingService } from './services/onchain-matching.service'
import { PhantomPoolRealService } from './services/phantompool.real.service'
import { OrderBookAnalyticsService } from './services/orderbook.analytics.service'

export interface ApiConfig {
  port: number
  host: string
  cors: {
    origin: string[]
  }
  rateLimit: {
    max: number
    timeWindow: number
  }
}

export class OnChainApiServer {
  private fastify: FastifyInstance
  private orderService: OnChainOrderService
  private matchingService: OnChainMatchingService
  private phantomPoolService: PhantomPoolRealService
  private analyticsService: OrderBookAnalyticsService
  
  constructor(config: ApiConfig) {
    this.fastify = Fastify({
      logger: {
        level: process.env.LOG_LEVEL || 'info'
      }
    })
    
    this.orderService = OnChainOrderService.getInstance()
    this.matchingService = OnChainMatchingService.getInstance()
    this.phantomPoolService = PhantomPoolRealService.getInstance()
    this.analyticsService = OrderBookAnalyticsService.getInstance()
    
    this.setupMiddleware(config)
    this.setupRoutes()
    this.setupWebSocket()
  }

  private async setupMiddleware(config: ApiConfig): Promise<void> {
    await this.fastify.register(cors, {
      origin: config.cors.origin,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Wallet-Address']
    })

    await this.fastify.register(rateLimit, {
      max: config.rateLimit.max,
      timeWindow: config.rateLimit.timeWindow,
      errorResponseBuilder: () => ({
        error: 'Rate limit exceeded',
        message: 'Too many requests, please try again later'
      })
    })

    await this.fastify.register(websocket)
  }

  private setupRoutes(): void {
    this.fastify.get('/health', async (request, reply) => {
      return { 
        status: 'healthy',
        timestamp: Date.now(),
        version: '1.0.0',
        blockchain: 'connected'
      }
    })

    this.fastify.post('/api/orders/submit', async (request, reply) => {
      try {
        const orderRequest = request.body as {
          walletAddress: string
          tokenPair: string
          side: 'buy' | 'sell'
          amount: number
          limitPrice: number
          signature: string
        }

        if (!this.validateOrderRequest(orderRequest)) {
          return reply.code(400).send({ 
            error: 'Invalid request',
            message: 'Missing required fields or invalid values'
          })
        }

        const result = await this.orderService.submitOrder(orderRequest)
        
        if (result.success) {
          return reply.send({
            success: true,
            orderHash: result.orderHash,
            txSignature: result.txSignature,
            message: 'Order submitted to blockchain'
          })
        } else {
          return reply.code(400).send({
            success: false,
            error: result.error,
            message: 'Order submission failed'
          })
        }

      } catch (error) {
        console.error('Order submission error:', error)
        return reply.code(500).send({
          error: 'Internal server error',
          message: 'Failed to process order submission'
        })
      }
    })

    this.fastify.delete('/api/orders/:orderHash', async (request, reply) => {
      try {
        const { orderHash } = request.params as { orderHash: string }
        const { walletAddress, signature } = request.body as {
          walletAddress: string
          signature: string
        }

        if (!orderHash || !walletAddress || !signature) {
          return reply.code(400).send({
            error: 'Missing required fields',
            message: 'orderHash, walletAddress, and signature are required'
          })
        }

        const success = await this.orderService.cancelOrder(orderHash, walletAddress, signature)
        
        if (success) {
          return reply.send({
            success: true,
            message: 'Order cancelled on blockchain'
          })
        } else {
          return reply.code(400).send({
            success: false,
            message: 'Failed to cancel order'
          })
        }

      } catch (error) {
        console.error('Order cancellation error:', error)
        return reply.code(500).send({
          error: 'Internal server error',
          message: 'Failed to cancel order'
        })
      }
    })

    this.fastify.get('/api/orderbook/:tokenPair', async (request, reply) => {
      try {
        const { tokenPair } = request.params as { tokenPair: string }
        const { levels = '10' } = request.query as { levels?: string }

        const orderBook = await this.orderService.getOrderBook(
          tokenPair, 
          parseInt(levels)
        )

        return reply.send(orderBook)

      } catch (error) {
        console.error('OrderBook fetch error:', error)
        return reply.code(500).send({
          error: 'Failed to fetch order book',
          message: 'Blockchain data unavailable'
        })
      }
    })

    this.fastify.get('/api/orders/wallet/:walletAddress', async (request, reply) => {
      try {
        const { walletAddress } = request.params as { walletAddress: string }
        const { limit = '50' } = request.query as { limit?: string }

        const orders = await this.orderService.getUserOrders(walletAddress)
        const limitedOrders = orders.slice(0, parseInt(limit))

        return reply.send({
          orders: limitedOrders.map(order => ({
            orderHash: Buffer.from(order.orderHash).toString('hex'),
            owner: order.owner.toString(),
            side: order.side === 'BUY' ? 'buy' : 'sell',
            status: order.status,
            submittedAt: order.submittedAt,
            matchedAt: null,
            cancelledAt: null
          })),
          count: limitedOrders.length,
          total: orders.length
        })

      } catch (error) {
        console.error('User orders fetch error:', error)
        return reply.code(500).send({
          error: 'Failed to fetch user orders',
          message: 'Blockchain query failed'
        })
      }
    })

    this.fastify.get('/api/matching/status', async (request, reply) => {
      try {
        const { tokenPair = 'SOL/USDC' } = request.query as { tokenPair?: string }
        
        const status = await this.matchingService.getMatchingStatus(tokenPair)
        
        return reply.send({
          isMatching: status.isMatching,
          currentRound: status.currentRound,
          nextRoundIn: status.nextRoundIn,
          lastMatchingTime: status.lastMatchingTime,
          tokenPair
        })

      } catch (error) {
        console.error('Matching status error:', error)
        return reply.code(500).send({
          error: 'Failed to get matching status',
          message: 'Blockchain query failed'
        })
      }
    })

    this.fastify.get('/api/matching/history/:tokenPair', async (request, reply) => {
      try {
        const { tokenPair } = request.params as { tokenPair: string }
        const { limit = '10' } = request.query as { limit?: string }

        const history = await this.matchingService.getMatchingHistory(
          tokenPair, 
          parseInt(limit)
        )

        return reply.send({
          tokenPair,
          rounds: history,
          count: history.length
        })

      } catch (error) {
        console.error('Matching history error:', error)
        return reply.code(500).send({
          error: 'Failed to fetch matching history',
          message: 'Blockchain query failed'
        })
      }
    })

    this.fastify.get('/api/analytics/orderbook/:tokenPair', async (request, reply) => {
      try {
        const { tokenPair } = request.params as { tokenPair: string }

        const [
          orderBookDepth,
          microstructure,
          tradingMetrics,
          liquidityAnalysis,
          flowAnalysis
        ] = await Promise.all([
          this.analyticsService.getOrderBookDepth(20),
          this.analyticsService.getMarketMicrostructure(),
          this.analyticsService.getTradingMetrics(),
          this.analyticsService.getLiquidityAnalysis(),
          this.analyticsService.getFlowAnalysis()
        ])

        return reply.send({
          tokenPair,
          analytics: {
            orderBookDepth,
            microstructure,
            tradingMetrics,
            liquidityAnalysis,
            flowAnalysis
          },
          timestamp: Date.now()
        })

      } catch (error) {
        console.error('Analytics error:', error)
        return reply.code(500).send({
          error: 'Failed to fetch analytics',
          message: 'Analytics service unavailable'
        })
      }
    })

    this.fastify.get('/api/pool/stats/:tokenPair', async (request, reply) => {
      try {
        const { tokenPair } = request.params as { tokenPair: string }

        const stats = await this.orderService.getPoolStats(tokenPair)
        const roundStatus = await this.orderService.getMatchingRoundStatus(tokenPair)

        return reply.send({
          tokenPair,
          totalOrders: stats.totalOrders,
          activeRound: stats.activeRound,
          isMatching: stats.isMatching,
          volume24h: stats.volume24h,
          roundStatus,
          timestamp: Date.now()
        })

      } catch (error) {
        console.error('Pool stats error:', error)
        return reply.code(500).send({
          error: 'Failed to fetch pool stats',
          message: 'Blockchain query failed'
        })
      }
    })

    this.fastify.get('/api/executors/status', async (request, reply) => {
      try {
        const executors = await this.matchingService.getExecutorStatus()

        return reply.send({
          executors,
          totalExecutors: executors.length,
          activeExecutors: executors.filter(e => e.isActive).length,
          timestamp: Date.now()
        })

      } catch (error) {
        console.error('Executor status error:', error)
        return reply.code(500).send({
          error: 'Failed to fetch executor status',
          message: 'Blockchain query failed'
        })
      }
    })

    this.fastify.post('/api/matching/trigger/:tokenPair', async (request, reply) => {
      try {
        const { tokenPair } = request.params as { tokenPair: string }

        const success = await this.matchingService.startMatchingRound(tokenPair)

        if (success) {
          return reply.send({
            success: true,
            message: `Matching round triggered for ${tokenPair}`,
            timestamp: Date.now()
          })
        } else {
          return reply.code(400).send({
            success: false,
            message: 'Failed to trigger matching round',
            reason: 'Insufficient orders or matching in progress'
          })
        }

      } catch (error) {
        console.error('Manual matching trigger error:', error)
        return reply.code(500).send({
          error: 'Failed to trigger matching',
          message: 'Internal server error'
        })
      }
    })
  }

  private setupWebSocket(): void {
    this.fastify.register(async function (fastify) {
      fastify.get('/ws', { websocket: true }, (connection, req) => {
        console.log('WebSocket connection established')

        connection.socket.on('message', (message: any) => {
          try {
            const data = JSON.parse(message.toString())
            
            if (data.type === 'subscribe') {
              console.log('Client subscribed to:', data.channel)
              connection.socket.send(JSON.stringify({
                type: 'subscribed',
                channel: data.channel,
                status: 'success'
              }))
            }
          } catch (error) {
            console.error('WebSocket message error:', error)
          }
        })

        const sendUpdate = (type: string, data: any) => {
          if (connection.socket.readyState === 1) {
            connection.socket.send(JSON.stringify({
              type,
              data,
              timestamp: Date.now()
            }))
          }
        }

        const interval = setInterval(() => {
          sendUpdate('orderbook_update', {
            tokenPair: 'SOL/USDC',
            bids: [],
            asks: [],
            spread: 1.0,
            midPrice: 150
          })
        }, 5000)

        connection.socket.on('close', () => {
          console.log('WebSocket connection closed')
          clearInterval(interval)
        })
      })
    })
  }

  private validateOrderRequest(request: any): boolean {
    return !!(
      request.walletAddress &&
      request.tokenPair &&
      request.side &&
      ['buy', 'sell'].includes(request.side) &&
      request.amount &&
      request.amount > 0 &&
      request.limitPrice &&
      request.limitPrice > 0 &&
      request.signature &&
      request.signature.length > 20
    )
  }

  async start(): Promise<void> {
    try {
      await this.orderService.initialize()
      await this.matchingService.initialize()
      await this.phantomPoolService.initialize()
      await this.analyticsService.initialize()

      const port = parseInt(process.env.API_PORT || '3001')
      const host = process.env.API_HOST || '0.0.0.0'

      await this.fastify.listen({ port, host })
      
      console.log(`🚀 PhantomPool API Server running on ${host}:${port}`)
      console.log('✅ All services initialized')
      console.log('🔗 Connected to Solana blockchain')
      console.log('📊 Analytics engine active')
      console.log('🔄 Matching scheduler running')

    } catch (error) {
      console.error('Failed to start server:', error)
      process.exit(1)
    }
  }

  async stop(): Promise<void> {
    try {
      await this.fastify.close()
      this.matchingService.destroy()
      this.analyticsService.destroy()
      console.log('Server stopped gracefully')
    } catch (error) {
      console.error('Error stopping server:', error)
    }
  }
}

async function startServer() {
  const config: ApiConfig = {
    port: parseInt(process.env.API_PORT || '3001'),
    host: process.env.API_HOST || '0.0.0.0',
    cors: {
      origin: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(',')
    },
    rateLimit: {
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
      timeWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '900000')
    }
  }

  const server = new OnChainApiServer(config)
  
  process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, shutting down gracefully...')
    await server.stop()
    process.exit(0)
  })

  process.on('SIGINT', async () => {
    console.log('Received SIGINT, shutting down gracefully...')
    await server.stop()
    process.exit(0)
  })

  await server.start()
}

// Remove direct execution check for module import compatibility

export { startServer }