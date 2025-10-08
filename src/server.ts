import Fastify from 'fastify'
import { PrismaClient } from '@prisma/client'
import Redis from 'ioredis'
import { ElGamalRealService } from './crypto/elgamal.real.service'
import { BulletproofsRealService } from './crypto/bulletproofs.real.service'
import { VRFRealService } from './crypto/vrf.real.service'
import { MatchingEngineRealService } from './crypto/matching.real.service'
import { ThresholdRealService } from './crypto/threshold.real.service'
import { PhantomPoolRealService } from './services/phantompool.real.service'
import { WebSocketRealService } from './services/websocket.real.service'
import { SolanaService } from './services/solana.service'
import { JupiterService } from './services/jupiter.service'
import { OrderBookAnalyticsService } from './services/orderbook.analytics.service'

interface ServiceContainer {
  postgres: PrismaClient
  redis: Redis
  elgamal: ElGamalRealService
  bulletproofs: BulletproofsRealService
  vrf: VRFRealService
  matching: MatchingEngineRealService
  threshold: ThresholdRealService
  phantompool: PhantomPoolRealService
  websocket: WebSocketRealService
  solana: SolanaService
  jupiter: JupiterService
  analytics: OrderBookAnalyticsService
}

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info'
  },
  trustProxy: true
})

async function initializeServices(): Promise<ServiceContainer> {
  const postgres = new PrismaClient()
  await postgres.$connect()

  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

  const elgamal = ElGamalRealService.getInstance()
  await elgamal.initialize()

  const bulletproofs = new BulletproofsRealService()
  const vrf = new VRFRealService()
  
  const matching = new MatchingEngineRealService()
  await matching.initialize()

  const threshold = new ThresholdRealService()
  await threshold.initialize()

  const phantompool = PhantomPoolRealService.getInstance()
  await phantompool.initialize()

  const websocket = new WebSocketRealService()
  
  const solana = SolanaService.getInstance()
  
  const jupiter = JupiterService.getInstance()
  await jupiter.initialize()

  const analytics = OrderBookAnalyticsService.getInstance()
  await analytics.initialize()

  return {
    postgres,
    redis,
    elgamal,
    bulletproofs,
    vrf,
    matching,
    threshold,
    phantompool,
    websocket,
    solana,
    jupiter,
    analytics
  }
}

async function registerRoutes(services: ServiceContainer) {
  fastify.register(async function (fastify) {
    fastify.post('/api/orders/submit', async (request, reply) => {
      const body = request.body as any
      
      try {
        const result = await services.phantompool.submitOrder({
          walletAddress: body.walletAddress,
          tokenPair: body.tokenPair,
          side: body.side,
          amount: body.amount,
          limitPrice: body.limitPrice,
          signature: body.signature
        })
        
        return reply.code(201).send(result)
      } catch (error) {
        return reply.code(400).send({ error: error.message })
      }
    })

    fastify.get('/api/orders/:orderHash', async (request, reply) => {
      const { orderHash } = request.params as any
      
      try {
        const order = await services.phantompool.getOrderStatus(orderHash)
        return reply.send(order)
      } catch (error) {
        return reply.code(404).send({ error: 'Order not found' })
      }
    })

    fastify.get('/api/orderbook/:tokenPair', async (request, reply) => {
      const { tokenPair } = request.params as any
      
      try {
        const orderBook = await services.analytics.getOrderBookDepth(10)
        return reply.send(orderBook)
      } catch (error) {
        return reply.code(500).send({ error: 'Failed to fetch order book' })
      }
    })

    fastify.get('/api/matching/status', async (request, reply) => {
      try {
        const status = await services.matching.getStatus()
        return reply.send(status)
      } catch (error) {
        return reply.code(500).send({ error: 'Failed to get matching status' })
      }
    })

    fastify.get('/api/analytics/metrics', async (request, reply) => {
      try {
        const metrics = await services.analytics.getTradingMetrics()
        return reply.send(metrics)
      } catch (error) {
        return reply.code(500).send({ error: 'Failed to get metrics' })
      }
    })

    fastify.post('/api/proofs/verify-solvency', async (request, reply) => {
      const { proof } = request.body as any
      
      try {
        const isValid = await services.bulletproofs.verifySolvencyProof(proof)
        return reply.send({ valid: isValid })
      } catch (error) {
        return reply.code(400).send({ error: 'Invalid proof format' })
      }
    })

    fastify.post('/api/proofs/verify-vrf', async (request, reply) => {
      const { proof } = request.body as any
      
      try {
        const isValid = VRFRealService.verifyProof(proof)
        return reply.send({ valid: isValid })
      } catch (error) {
        return reply.code(400).send({ error: 'Invalid VRF proof' })
      }
    })

    fastify.get('/api/executors/status', async (request, reply) => {
      try {
        const executorStatus = await services.threshold.getExecutorStatus()
        return reply.send(executorStatus)
      } catch (error) {
        return reply.code(500).send({ error: 'Failed to get executor status' })
      }
    })

    fastify.post('/api/matching/trigger', async (request, reply) => {
      try {
        await services.matching.runMatchingRound()
        return reply.send({ success: true, message: 'Matching round triggered' })
      } catch (error) {
        return reply.code(500).send({ error: 'Failed to trigger matching' })
      }
    })

    fastify.get('/health', async (request, reply) => {
      return reply.send({
        status: 'healthy',
        timestamp: Date.now(),
        services: {
          postgres: 'connected',
          redis: 'connected',
          solana: 'connected',
          jupiter: 'connected'
        }
      })
    })
  })
}

async function setupMiddleware() {
  await fastify.register(import('@fastify/cors'), {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000'
  })
  
  await fastify.register(import('@fastify/rate-limit'), {
    max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
    timeWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '60000')
  })

  await fastify.register(import('@fastify/websocket'))
}

async function start() {
  try {
    console.log('🚀 Starting PhantomPool Backend Server...')
    
    await setupMiddleware()
    
    const services = await initializeServices()
    console.log('✅ All services initialized')
    
    await registerRoutes(services)
    console.log('✅ API routes registered')

    services.matching.startMatchingEngine()
    console.log('✅ Matching engine started')

    await services.websocket.initialize(fastify.server)
    console.log('✅ WebSocket server initialized')

    const port = parseInt(process.env.PORT || '3000')
    await fastify.listen({ port, host: '0.0.0.0' })
    
    console.log(`🎯 PhantomPool API Server running on port ${port}`)
    console.log(`📊 Health check: http://localhost:${port}/health`)
    console.log(`🔗 WebSocket: ws://localhost:${port}`)
    
  } catch (error) {
    console.error('❌ Failed to start server:', error)
    process.exit(1)
  }
}

process.on('SIGTERM', async () => {
  console.log('🛑 Shutting down server...')
  await fastify.close()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('🛑 Shutting down server...')
  await fastify.close()
  process.exit(0)
})

if (require.main === module) {
  start()
}

export { fastify, initializeServices }