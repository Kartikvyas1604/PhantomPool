import { PrismaClient, Order, OrderStatus, OrderSide } from '@prisma/client'
import { ElGamalRealService, EncryptedOrder } from '../crypto/elgamal.real.service'
import { BulletproofsRealService } from '../crypto/bulletproofs.real.service'

interface OrderSubmissionRequest {
  walletAddress: string
  tokenPair: string
  side: OrderSide
  amount: number
  limitPrice: number
  signature: string
}

interface OrderSubmissionResult {
  success: boolean
  orderHash: string
  encryptedOrder: EncryptedOrder
  estimatedMatchTime: number
}

export class OrderService {
  private static instance: OrderService
  private prisma: PrismaClient

  constructor() {
    this.prisma = new PrismaClient()
  }

  static getInstance(): OrderService {
    if (!this.instance) {
      this.instance = new OrderService()
    }
    return this.instance
  }

  async submitOrder(request: OrderSubmissionRequest): Promise<OrderSubmissionResult> {
    const elgamal = ElGamalRealService.getInstance()
    const bulletproofs = new BulletproofsRealService()

    const mockBalance = 50000

    const solvencyProof = await bulletproofs.generateSolvencyProof(
      mockBalance,
      request.side === 'BUY' ? request.amount * request.limitPrice : request.amount
    )

    const plainOrder = {
      walletAddress: request.walletAddress,
      tokenPair: request.tokenPair,
      side: request.side,
      amount: request.amount,
      limitPrice: request.limitPrice,
      timestamp: Date.now(),
      nonce: this.generateNonce()
    }

    const publicKey = elgamal.getPublicKey()
    const encryptedOrder = await elgamal.encryptOrder(plainOrder, publicKey)

    await this.prisma.order.create({
      data: {
        orderHash: encryptedOrder.orderHash,
        walletAddress: request.walletAddress,
        tokenPair: request.tokenPair,
        side: request.side,
        encryptedAmount: encryptedOrder.encryptedAmount as any,
        encryptedPrice: encryptedOrder.encryptedPrice as any,
        solvencyProof: solvencyProof as any,
        status: OrderStatus.PENDING
      }
    })

    await this.updateUserStats(request.walletAddress)

    return {
      success: true,
      orderHash: encryptedOrder.orderHash,
      encryptedOrder,
      estimatedMatchTime: 30
    }
  }

  async getOrder(orderHash: string): Promise<Order | null> {
    return await this.prisma.order.findUnique({
      where: { orderHash },
      include: {
        user: true,
        buyTrade: true,
        sellTrade: true
      }
    })
  }

  async getUserOrders(walletAddress: string, limit: number = 50): Promise<Order[]> {
    return await this.prisma.order.findMany({
      where: { walletAddress },
      orderBy: { submittedAt: 'desc' },
      take: limit
    })
  }

  async getPendingOrders(tokenPair: string): Promise<Order[]> {
    return await this.prisma.order.findMany({
      where: {
        tokenPair,
        status: OrderStatus.PENDING
      },
      orderBy: { submittedAt: 'asc' }
    })
  }

  async updateOrderStatus(
    orderHash: string,
    status: OrderStatus,
    additionalData?: Partial<Order>
  ): Promise<Order> {
    return await this.prisma.order.update({
      where: { orderHash },
      data: {
        status,
        ...additionalData
      }
    })
  }

  async cancelOrder(orderHash: string): Promise<void> {
    await this.prisma.order.update({
      where: { orderHash },
      data: {
        status: OrderStatus.CANCELLED,
        cancelledAt: new Date()
      }
    })
  }

  async getOrderBookStats(tokenPair: string): Promise<{
    buyCount: number
    sellCount: number
    totalOrders: number
  }> {
    const [buyCount, sellCount] = await Promise.all([
      this.prisma.order.count({
        where: { tokenPair, side: OrderSide.BUY, status: OrderStatus.PENDING }
      }),
      this.prisma.order.count({
        where: { tokenPair, side: OrderSide.SELL, status: OrderStatus.PENDING }
      })
    ])

    return {
      buyCount,
      sellCount,
      totalOrders: buyCount + sellCount
    }
  }

  async createMatchingRound(data: {
    tokenPair: string
    buyOrderCount: number
    sellOrderCount: number
    vrfProof: any
    shuffleProof: any
  }): Promise<any> {
    return await this.prisma.matchingRound.create({
      data: {
        tokenPair: data.tokenPair,
        buyOrderCount: data.buyOrderCount,
        sellOrderCount: data.sellOrderCount,
        matchedCount: 0,
        vrfProof: data.vrfProof,
        shuffleProof: data.shuffleProof,
        executorSigs: []
      }
    })
  }

  async completeMatchingRound(
    roundId: string,
    matchedCount: number,
    clearingPrice: number,
    totalVolume: number,
    matchingProof: any
  ): Promise<void> {
    await this.prisma.matchingRound.update({
      where: { id: roundId },
      data: {
        matchedCount,
        clearingPrice,
        totalVolume,
        matchingProof,
        completedAt: new Date(),
        status: 'COMPLETED'
      }
    })
  }

  async logAuditEvent(
    eventType: string,
    entityType: string,
    entityId: string,
    data: any,
    walletAddress?: string
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        eventType,
        entityType,
        entityId,
        walletAddress,
        data,
        ipAddress: '127.0.0.1'
      }
    })
  }

  async updateSystemMetrics(metrics: {
    activeOrders: number
    matchedOrders: number
    executedTrades: number
    avgMatchTime: number
    avgExecutionTime: number
    encryptionOps: number
    decryptionOps: number
    proofGenOps: number
    proofVerifyOps: number
  }): Promise<void> {
    await this.prisma.systemMetrics.create({
      data: {
        ...metrics,
        networkLatency: Math.floor(Math.random() * 100) + 50,
        systemLoad: Math.random() * 0.8 + 0.1
      }
    })
  }

  private async updateUserStats(walletAddress: string): Promise<void> {
    await this.prisma.user.upsert({
      where: { walletAddress },
      update: {
        totalOrders: { increment: 1 }
      },
      create: {
        walletAddress,
        totalOrders: 1
      }
    })
  }

  private generateNonce(): string {
    return `nonce_${Date.now()}_${Math.random().toString(36).substring(2)}`
  }

  async destroy(): Promise<void> {
    await this.prisma.$disconnect()
  }
}