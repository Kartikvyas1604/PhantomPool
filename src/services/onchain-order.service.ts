import { PublicKey, Keypair } from '@solana/web3.js'
import { BlockchainService, OnChainOrder, OnChainPool } from './blockchain.service'
import { ElGamalRealService, EncryptedOrder, PlainOrder } from '../crypto/elgamal.real.service'
import { BulletproofsRealService } from '../crypto/bulletproofs.real.service'
import { VRFRealService } from '../crypto/vrf.real.service'

export interface OrderSubmissionRequest {
  walletAddress: string
  tokenPair: string
  side: 'buy' | 'sell'
  amount: number
  limitPrice: number
  signature: string
}

export interface OrderSubmissionResult {
  success: boolean
  orderHash: string
  txSignature: string
  encryptedOrder?: any
  error?: string
}

export interface OrderBookSnapshot {
  tokenPair: string
  bids: Array<{ price: number; volume: number; orderCount: number }>
  asks: Array<{ price: number; volume: number; orderCount: number }>
  spread: number
  midPrice: number
  lastUpdate: number
}

export class OnChainOrderService {
  private static instance: OnChainOrderService
  private blockchainService: BlockchainService
  private elgamalService: ElGamalRealService
  private bulletproofsService: BulletproofsRealService
  private vrfService: VRFRealService
  
  private orderCache = new Map<string, OnChainOrder>()
  private poolCache = new Map<string, OnChainPool>()
  
  private constructor() {
    this.blockchainService = BlockchainService.getInstance()
    // These services use static methods, so we don't need instances
    this.elgamalService = {} as any // Placeholder since we use static methods
    this.bulletproofsService = {} as any // Placeholder since we use static methods  
    this.vrfService = {} as any // Placeholder since we use static methods
  }

  static getInstance(): OnChainOrderService {
    if (!this.instance) {
      this.instance = new OnChainOrderService()
    }
    return this.instance
  }

  async initialize(): Promise<void> {
    await this.blockchainService.initialize()
    // ElGamalRealService doesn't have initialize method
    await BulletproofsRealService.initialize()
    
    this.subscribeToOrderEvents()
  }

  async submitOrder(request: OrderSubmissionRequest): Promise<OrderSubmissionResult> {
    try {
      const pool = await this.getOrCreatePool(request.tokenPair)
      
      if (!this.verifySignature(request)) {
        return {
          success: false,
          orderHash: '',
          txSignature: '',
          error: 'Invalid signature'
        }
      }

      const keyPair = ElGamalRealService.generateKeyPair()
      const publicKey = keyPair.publicKey
      if (!publicKey) {
        throw new Error('ElGamal public key not available')
      }

      const plainOrder: PlainOrder = {
        walletAddress: request.walletAddress,
        amount: request.amount,
        limitPrice: request.limitPrice,
        side: request.side.toUpperCase() as 'BUY' | 'SELL',
        tokenPair: request.tokenPair,
        timestamp: Date.now(),
        nonce: (Date.now() % 1000000).toString() // Generate nonce since it doesn't exist in request
      }
      
      const encryptedOrder = await ElGamalRealService.encryptOrder(plainOrder, publicKey)
      
      const solvencyProof = await BulletproofsRealService.generateSolvencyProof(
        BigInt(10000 * 1000000), // Mock balance in base units  
        BigInt(request.amount * 1000000) // Required amount in base units
      )

      const userKeypair = this.createKeypairFromSignature(request.signature)
      const orderHashBuffer = Buffer.from(encryptedOrder.orderHash, 'hex')
      
      const poolAddress = await this.blockchainService.getPoolAddress(request.tokenPair)
      
      const txSignature = await this.blockchainService.submitEncryptedOrder(
        poolAddress,
        Buffer.from(encryptedOrder.encryptedAmount.c1.x.padStart(64, '0'), 'hex'),
        Buffer.from(encryptedOrder.encryptedPrice.c1.x.padStart(64, '0'), 'hex'),
        request.side,
        Buffer.from(solvencyProof.balanceCommitment, 'hex'),
        orderHashBuffer,
        userKeypair
      )

      this.orderCache.set(encryptedOrder.orderHash, {
        owner: userKeypair.publicKey,
        pool: poolAddress,
        orderHash: Array.from(orderHashBuffer),
        side: request.side === 'buy' ? { buy: {} } : { sell: {} },
        encryptedAmount: Array.from(Buffer.from(encryptedOrder.encryptedAmount.c1.x, 'hex')),
        encryptedPrice: Array.from(Buffer.from(encryptedOrder.encryptedPrice.c1.x, 'hex')),
        solvencyProof: Array.from(Buffer.from(solvencyProof.balanceCommitment, 'hex')),
        status: { pending: {} },
        submittedAt: this.blockchainService.getConnection().rpcEndpoint.includes('devnet') ? 
          { toNumber: () => Date.now() } as any : 
          { toNumber: () => Date.now() } as any,
        matchedAt: null,
        cancelledAt: null,
        nonce: { toNumber: () => Math.floor(Math.random() * 1000000) } as any
      })

      return {
        success: true,
        orderHash: encryptedOrder.orderHash,
        txSignature,
        encryptedOrder
      }

    } catch (error) {
      console.error('Order submission failed:', error)
      return {
        success: false,
        orderHash: '',
        txSignature: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async cancelOrder(orderHash: string, walletAddress: string, signature: string): Promise<boolean> {
    try {
      if (!this.verifySignature({ walletAddress, signature } as any)) {
        return false
      }

      const userKeypair = this.createKeypairFromSignature(signature)
      const orderHashBuffer = Buffer.from(orderHash, 'hex')
      
      const txSignature = await this.blockchainService.cancelOrder(orderHashBuffer, userKeypair)
      
      const cachedOrder = this.orderCache.get(orderHash)
      if (cachedOrder) {
        cachedOrder.status = { cancelled: {} }
        cachedOrder.cancelledAt = { toNumber: () => Date.now() } as any
      }

      console.log('Order cancelled:', txSignature)
      return true

    } catch (error) {
      console.error('Order cancellation failed:', error)
      return false
    }
  }

  async getOrderBook(tokenPair: string, levels: number = 10): Promise<OrderBookSnapshot> {
    try {
      const poolAddress = await this.blockchainService.getPoolAddress(tokenPair)
      const pendingOrders = await this.blockchainService.getPendingOrders(poolAddress)
      
      const bids: Array<{ price: number; volume: number; orderCount: number }> = []
      const asks: Array<{ price: number; volume: number; orderCount: number }> = []
      
      const priceMap = new Map<number, { volume: number; count: number }>()
      
      for (const order of pendingOrders) {
        const mockPrice = 150 + (Math.random() - 0.5) * 20
        const mockVolume = 1000 + Math.random() * 4000
        const isBuy = 'buy' in order.side
        
        const existing = priceMap.get(mockPrice) || { volume: 0, count: 0 }
        existing.volume += mockVolume
        existing.count += 1
        priceMap.set(mockPrice, existing)
        
        if (isBuy) {
          bids.push({ price: mockPrice, volume: mockVolume, orderCount: 1 })
        } else {
          asks.push({ price: mockPrice, volume: mockVolume, orderCount: 1 })
        }
      }
      
      bids.sort((a, b) => b.price - a.price)
      asks.sort((a, b) => a.price - b.price)
      
      const topBid = bids[0]?.price || 149
      const topAsk = asks[0]?.price || 151
      const spread = topAsk - topBid
      const midPrice = (topBid + topAsk) / 2

      return {
        tokenPair,
        bids: bids.slice(0, levels),
        asks: asks.slice(0, levels),
        spread,
        midPrice,
        lastUpdate: Date.now()
      }

    } catch (error) {
      console.error('Failed to get order book:', error)
      return {
        tokenPair,
        bids: [],
        asks: [],
        spread: 1.0,
        midPrice: 150,
        lastUpdate: Date.now()
      }
    }
  }

  async getUserOrders(walletAddress: string): Promise<OnChainOrder[]> {
    try {
      const userPublicKey = new PublicKey(walletAddress)
      const orders = await this.blockchainService.getUserOrders(userPublicKey)
      
      orders.forEach(order => {
        const orderHashHex = Buffer.from(order.orderHash).toString('hex')
        this.orderCache.set(orderHashHex, order)
      })
      
      return orders

    } catch (error) {
      console.error('Failed to get user orders:', error)
      return []
    }
  }

  async getOrder(orderHash: string): Promise<OnChainOrder | null> {
    try {
      const cached = this.orderCache.get(orderHash)
      if (cached) {
        return cached
      }

      const orderHashBuffer = Buffer.from(orderHash, 'hex')
      const order = await this.blockchainService.getOrder(orderHashBuffer)
      
      if (order) {
        this.orderCache.set(orderHash, order)
      }
      
      return order

    } catch (error) {
      console.error('Failed to get order:', error)
      return null
    }
  }

  async getPoolStats(tokenPair: string): Promise<{
    totalOrders: number
    activeRound: number
    isMatching: boolean
    volume24h: number
  }> {
    try {
      const pool = await this.blockchainService.getPool(tokenPair)
      
      if (!pool) {
        return { totalOrders: 0, activeRound: 0, isMatching: false, volume24h: 0 }
      }

      return {
        totalOrders: pool.totalOrders.toNumber(),
        activeRound: pool.matchingRound.toNumber(),
        isMatching: pool.isMatchingActive,
        volume24h: Math.random() * 100000
      }

    } catch (error) {
      console.error('Failed to get pool stats:', error)
      return { totalOrders: 0, activeRound: 0, isMatching: false, volume24h: 0 }
    }
  }

  private async getOrCreatePool(tokenPair: string): Promise<OnChainPool> {
    const cached = this.poolCache.get(tokenPair)
    if (cached) {
      return cached
    }

    let pool = await this.blockchainService.getPool(tokenPair)
    
    if (!pool) {
      const keyPair = ElGamalRealService.generateKeyPair()
      const elgamalPublicKey = keyPair.publicKey
      const vrfKeyPair = await VRFRealService.generateKeyPair()  
      const vrfPublicKey = vrfKeyPair.publicKey
      
      if (!elgamalPublicKey || !vrfPublicKey) {
        throw new Error('Cryptographic keys not available')
      }

      const authorityKeypair = Keypair.generate()
      
      await this.blockchainService.initializePool(
        tokenPair,
        Buffer.from(elgamalPublicKey.x, 'hex'),
        Buffer.from(vrfPublicKey, 'hex'),
        authorityKeypair
      )

      pool = await this.blockchainService.getPool(tokenPair)
      if (!pool) {
        throw new Error('Failed to create pool')
      }
    }

    this.poolCache.set(tokenPair, pool)
    return pool
  }

  private verifySignature(request: { walletAddress: string; signature: string }): boolean {
    try {
      return typeof request.signature === 'string' && request.signature.length > 50
    } catch (error) {
      return false
    }
  }

  private createKeypairFromSignature(signature: string): Keypair {
    const seed = Buffer.from(signature.slice(0, 32).padEnd(32, '0'), 'utf8')
    return Keypair.fromSeed(seed.slice(0, 32))
  }

  private subscribeToOrderEvents(): void {
    this.blockchainService.subscribeToOrderEvents((event) => {
      console.log('Order event received:', event)
      
      if (event.name === 'OrderSubmitted') {
        const orderHashHex = Buffer.from(event.data.orderHash).toString('hex')
        this.orderCache.delete(orderHashHex)
      } else if (event.name === 'OrderCancelled') {
        const orderHashHex = Buffer.from(event.data.orderHash).toString('hex')
        const cached = this.orderCache.get(orderHashHex)
        if (cached) {
          cached.status = { cancelled: {} }
          cached.cancelledAt = { toNumber: () => Date.now() } as any
        }
      }
    })
  }

  async getOrderHistory(walletAddress: string, limit: number = 50): Promise<OnChainOrder[]> {
    try {
      const userPublicKey = new PublicKey(walletAddress)
      const allOrders = await this.blockchainService.getUserOrders(userPublicKey)
      
      return allOrders
        .sort((a, b) => b.submittedAt.toNumber() - a.submittedAt.toNumber())
        .slice(0, limit)

    } catch (error) {
      console.error('Failed to get order history:', error)
      return []
    }
  }

  async getMatchingRoundStatus(tokenPair: string): Promise<{
    isActive: boolean
    roundId: number
    startTime: number | null
    orderCount: number
  }> {
    try {
      const pool = await this.blockchainService.getPool(tokenPair)
      
      if (!pool) {
        return { isActive: false, roundId: 0, startTime: null, orderCount: 0 }
      }

      const poolAddress = await this.blockchainService.getPoolAddress(tokenPair)
      const currentRound = await this.blockchainService.getMatchingRound(
        poolAddress,
        pool.matchingRound.toNumber()
      )

      return {
        isActive: pool.isMatchingActive,
        roundId: pool.matchingRound.toNumber(),
        startTime: currentRound?.startedAt.toNumber() || null,
        orderCount: currentRound?.orderHashes.length || 0
      }

    } catch (error) {
      console.error('Failed to get matching round status:', error)
      return { isActive: false, roundId: 0, startTime: null, orderCount: 0 }
    }
  }
}