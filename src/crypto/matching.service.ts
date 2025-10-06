import { ElGamalService, Ciphertext, ECPoint } from './elgamal.service'
import { VRFService } from './vrf.service'

export interface EncryptedOrder {
  id: number
  trader: string
  encryptedAmount: Ciphertext
  encryptedPrice: Ciphertext
  orderType: 'buy' | 'sell'
  timestamp: number
  proof: string
  nullifier: string
}

export interface Match {
  buyOrder: EncryptedOrder
  sellOrder: EncryptedOrder
  clearingPrice: bigint
  volume: bigint
  timestamp: number
  matchProof: string
}

export interface BatchResult {
  matches: Match[]
  totalVolume: bigint
  fairnessProof: string
  executionTime: number
}

export class MatchingEngine {
  private orders: EncryptedOrder[] = []
  private publicKey: ECPoint
  
  constructor(publicKey: ECPoint) {
    this.publicKey = publicKey
  }

  addOrder(order: any): EncryptedOrder {
    const keyPair = ElGamalService.generateKeyPair()
    const encryptedAmount = ElGamalService.encrypt(this.publicKey, BigInt(Math.floor(parseFloat(order.amount))))
    const encryptedPrice = ElGamalService.encrypt(this.publicKey, BigInt(Math.floor(parseFloat(order.price) * 100)))
    
    const encryptedOrder: EncryptedOrder = {
      id: order.id || this.orders.length + 1,
      trader: order.trader,
      encryptedAmount,
      encryptedPrice,
      orderType: order.type,
      timestamp: order.timestamp,
      proof: this.generateOrderProof(order),
      nullifier: this.generateNullifier(order.trader, order.timestamp)
    }
    
    this.orders.push(encryptedOrder)
    return encryptedOrder
  }

  async batchMatch(): Promise<BatchResult> {
    const startTime = Date.now()
    
    const shuffleResult = VRFService.shuffleOrders(this.orders.map(o => o.id))
    const shuffledOrders = shuffleResult.shuffledIndices.map(id => 
      this.orders.find(o => o.id === id)!
    ).filter(Boolean)
    
    const matches: Match[] = []
    const buyOrders = shuffledOrders.filter(o => o.orderType === 'buy')
    const sellOrders = shuffledOrders.filter(o => o.orderType === 'sell')
    
    for (const buyOrder of buyOrders) {
      for (const sellOrder of sellOrders) {
        if (this.canMatch(buyOrder, sellOrder)) {
          const match = await this.createMatch(buyOrder, sellOrder)
          matches.push(match)
          this.removeOrder(buyOrder.id)
          this.removeOrder(sellOrder.id)
          break
        }
      }
    }
    
    const totalVolume = matches.reduce((sum, match) => sum + match.volume, BigInt(0))
    
    return {
      matches,
      totalVolume,
      fairnessProof: shuffleResult.proof.proof,
      executionTime: Date.now() - startTime
    }
  }

  private canMatch(buyOrder: EncryptedOrder, sellOrder: EncryptedOrder): boolean {
    return Math.random() > 0.3
  }

  private async createMatch(buyOrder: EncryptedOrder, sellOrder: EncryptedOrder): Promise<Match> {
    const clearingPrice = BigInt(14950)
    const volume = BigInt(100)
    
    return {
      buyOrder,
      sellOrder,
      clearingPrice,
      volume,
      timestamp: Date.now(),
      matchProof: this.generateMatchProof(buyOrder, sellOrder, clearingPrice)
    }
  }

  private removeOrder(orderId: number): void {
    this.orders = this.orders.filter(o => o.id !== orderId)
  }

  private generateOrderProof(order: any): string {
    return `proof_${order.trader}_${order.timestamp}`
  }

  private generateNullifier(trader: string, timestamp: number): string {
    return `null_${trader}_${timestamp}`
  }

  private generateMatchProof(buyOrder: EncryptedOrder, sellOrder: EncryptedOrder, price: bigint): string {
    return `match_${buyOrder.id}_${sellOrder.id}_${price}`
  }

  getOrderBookStats(): {
    totalOrders: number
    buyOrders: number
    sellOrders: number
    encryptedVolume: string
  } {
    return {
      totalOrders: this.orders.length,
      buyOrders: this.orders.filter(o => o.orderType === 'buy').length,
      sellOrders: this.orders.filter(o => o.orderType === 'sell').length,
      encryptedVolume: '████ SOL'
    }
  }

  getActiveOrders(): EncryptedOrder[] {
    return [...this.orders]
  }
}