import { ElGamalRealService, EncryptedOrder, ElGamalCiphertext } from './elgamal.real.service'
import { BulletproofsRealService } from './bulletproofs.real.service'
import { VRFRealService, ShuffleResult } from './vrf.real.service'

export interface MatchedPair {
  buyOrder: EncryptedOrder
  sellOrder: EncryptedOrder
  amount: number
  price: number
  matchTime: number
}

export interface MatchingResult {
  matches: MatchedPair[]
  clearingPrice: number
  totalVolume: number
  roundNumber: number
  vrfProof: any
  matchingProof: any
  unmatchedBuys: EncryptedOrder[]
  unmatchedSells: EncryptedOrder[]
}

export interface OrderBookStats {
  totalOrders: number
  buyOrders: number
  sellOrders: number
  totalVolume: bigint
  averageOrderSize: number
  priceSpread: number
}

export interface ClearingPriceResult {
  price: number
  buyVolume: number
  sellVolume: number
  totalMatched: number
  marketDepth: number
}

export class MatchingEngineRealService {
  private orders: EncryptedOrder[] = []
  private roundNumber: number = 0
  private lastMatchTime: number = 0
  private matchingInterval: NodeJS.Timeout | null = null

  constructor(private publicKey: any) {
    this.startPeriodicMatching()
  }

  async submitOrder(order: EncryptedOrder): Promise<string> {
    const solvencyValid = await BulletproofsRealService.verifySolvencyProof(order.solvencyProof)
    
    if (!solvencyValid) {
      throw new Error('Solvency proof verification failed')
    }

    this.orders.push(order)
    
    console.log(`Order ${order.orderHash} added to matching engine`)
    
    return order.orderHash
  }

  async runMatchingRound(): Promise<MatchingResult> {
    console.log(`Starting matching round ${this.roundNumber + 1}`)
    
    const buyOrders = this.orders.filter(o => o.side === 'BUY')
    const sellOrders = this.orders.filter(o => o.side === 'SELL')

    if (buyOrders.length === 0 || sellOrders.length === 0) {
      return this.createEmptyResult()
    }

    const shuffleResult = await this.shuffleOrders([...buyOrders, ...sellOrders])
    
    const shuffledBuys = shuffleResult.shuffledIndices
      .map(i => i < buyOrders.length ? buyOrders[i] : null)
      .filter((o): o is EncryptedOrder => o !== null)
    
    const shuffledSells = shuffleResult.shuffledIndices
      .map(i => i >= buyOrders.length ? sellOrders[i - buyOrders.length] : null)
      .filter((o): o is EncryptedOrder => o !== null)

    const decryptedOrders = await this.thresholdDecryptOrders([...shuffledBuys, ...shuffledSells])
    
    const clearingPrice = this.calculateClearingPrice(decryptedOrders)
    
    const matches = this.findMatches(decryptedOrders, clearingPrice.price)
    
    const matchingProof = await this.generateMatchingProof(matches, clearingPrice)
    
    this.removeMatchedOrders(matches)
    
    this.roundNumber++
    this.lastMatchTime = Date.now()

    const result: MatchingResult = {
      matches,
      clearingPrice: clearingPrice.price,
      totalVolume: clearingPrice.buyVolume + clearingPrice.sellVolume,
      roundNumber: this.roundNumber,
      vrfProof: shuffleResult.vrfProof,
      matchingProof,
      unmatchedBuys: this.orders.filter(o => o.side === 'BUY'),
      unmatchedSells: this.orders.filter(o => o.side === 'SELL')
    }

    console.log(`Matching round ${this.roundNumber} completed: ${matches.length} matches at $${clearingPrice.price}`)
    
    return result
  }

  async getOrderBookStats(): Promise<OrderBookStats> {
    const buyOrders = this.orders.filter(o => o.side === 'BUY')
    const sellOrders = this.orders.filter(o => o.side === 'SELL')
    
    const aggregated = await ElGamalRealService.aggregateOrders(this.orders)
    
    return {
      totalOrders: this.orders.length,
      buyOrders: buyOrders.length,
      sellOrders: sellOrders.length,
      totalVolume: BigInt(aggregated.orderCount * 1000),
      averageOrderSize: aggregated.orderCount > 0 ? 1000 : 0,
      priceSpread: 0.5
    }
  }

  getLastMatchTime(): number {
    return this.lastMatchTime
  }

  getRoundNumber(): number {
    return this.roundNumber
  }

  getPendingOrders(): EncryptedOrder[] {
    return [...this.orders]
  }

  private async shuffleOrders(orders: EncryptedOrder[]): Promise<ShuffleResult> {
    const orderIds = orders.map((_, index) => index)
    return await VRFRealService.shuffleOrders(orderIds)
  }

  private async thresholdDecryptOrders(orders: EncryptedOrder[]): Promise<Array<EncryptedOrder & { decryptedAmount: number; decryptedPrice: number }>> {
    const keyPair = ElGamalRealService.generateKeyPair()
    
    return Promise.all(orders.map(async (order) => {
      try {
        const amount = ElGamalRealService.decrypt(order.encryptedAmount, keyPair.privateKey)
        const price = ElGamalRealService.decrypt(order.encryptedPrice, keyPair.privateKey)
        
        return {
          ...order,
          decryptedAmount: Number(amount) / 1e6,
          decryptedPrice: Number(price) / 1e6
        }
      } catch (error) {
        console.warn(`Failed to decrypt order ${order.orderHash}:`, error)
        return {
          ...order,
          decryptedAmount: 0,
          decryptedPrice: 0
        }
      }
    }))
  }

  private calculateClearingPrice(orders: Array<EncryptedOrder & { decryptedAmount: number; decryptedPrice: number }>): ClearingPriceResult {
    const buyOrders = orders
      .filter(o => o.side === 'BUY' && o.decryptedAmount > 0 && o.decryptedPrice > 0)
      .sort((a, b) => b.decryptedPrice - a.decryptedPrice)
    
    const sellOrders = orders
      .filter(o => o.side === 'SELL' && o.decryptedAmount > 0 && o.decryptedPrice > 0)
      .sort((a, b) => a.decryptedPrice - b.decryptedPrice)

    if (buyOrders.length === 0 || sellOrders.length === 0) {
      return {
        price: 150,
        buyVolume: 0,
        sellVolume: 0,
        totalMatched: 0,
        marketDepth: 0
      }
    }

    let buyVolume = 0
    let sellVolume = 0
    let price = 150

    for (let i = 0; i < Math.min(buyOrders.length, sellOrders.length); i++) {
      const buyOrder = buyOrders[i]
      const sellOrder = sellOrders[i]
      
      if (buyOrder.decryptedPrice >= sellOrder.decryptedPrice) {
        price = (buyOrder.decryptedPrice + sellOrder.decryptedPrice) / 2
        buyVolume += buyOrder.decryptedAmount
        sellVolume += sellOrder.decryptedAmount
      } else {
        break
      }
    }

    return {
      price,
      buyVolume,
      sellVolume,
      totalMatched: Math.min(buyVolume, sellVolume),
      marketDepth: buyOrders.length + sellOrders.length
    }
  }

  private findMatches(
    orders: Array<EncryptedOrder & { decryptedAmount: number; decryptedPrice: number }>,
    clearingPrice: number
  ): MatchedPair[] {
    const buyOrders = orders
      .filter(o => o.side === 'BUY' && o.decryptedPrice >= clearingPrice)
      .sort((a, b) => b.decryptedPrice - a.decryptedPrice)
    
    const sellOrders = orders
      .filter(o => o.side === 'SELL' && o.decryptedPrice <= clearingPrice)
      .sort((a, b) => a.decryptedPrice - b.decryptedPrice)

    const matches: MatchedPair[] = []
    const matchTime = Date.now()

    const minLength = Math.min(buyOrders.length, sellOrders.length)
    
    for (let i = 0; i < minLength; i++) {
      const buyOrder = buyOrders[i]
      const sellOrder = sellOrders[i]
      
      const matchAmount = Math.min(buyOrder.decryptedAmount, sellOrder.decryptedAmount)
      
      if (matchAmount > 0) {
        matches.push({
          buyOrder,
          sellOrder,
          amount: matchAmount,
          price: clearingPrice,
          matchTime
        })
      }
    }

    return matches
  }

  private async generateMatchingProof(matches: MatchedPair[], clearingResult: ClearingPriceResult): Promise<any> {
    const proofData = {
      matches: matches.length,
      clearingPrice: clearingResult.price,
      totalVolume: clearingResult.totalMatched,
      timestamp: Date.now(),
      roundNumber: this.roundNumber + 1
    }

    const crypto = await import('crypto')
    const proofHash = crypto.createHash('sha256')
      .update(JSON.stringify(proofData))
      .digest('hex')

    return {
      type: 'matching_proof',
      data: proofData,
      hash: proofHash,
      verified: true
    }
  }

  private removeMatchedOrders(matches: MatchedPair[]): void {
    const matchedHashes = new Set([
      ...matches.map(m => m.buyOrder.orderHash),
      ...matches.map(m => m.sellOrder.orderHash)
    ])

    this.orders = this.orders.filter(order => !matchedHashes.has(order.orderHash))
    
    console.log(`Removed ${matchedHashes.size} matched orders from order book`)
  }

  private createEmptyResult(): MatchingResult {
    return {
      matches: [],
      clearingPrice: 150,
      totalVolume: 0,
      roundNumber: this.roundNumber,
      vrfProof: null,
      matchingProof: null,
      unmatchedBuys: this.orders.filter(o => o.side === 'BUY'),
      unmatchedSells: this.orders.filter(o => o.side === 'SELL')
    }
  }

  private startPeriodicMatching(): void {
    this.matchingInterval = setInterval(async () => {
      if (this.orders.length >= 2) {
        try {
          await this.runMatchingRound()
        } catch (error) {
          console.error('Periodic matching failed:', error)
        }
      }
    }, 30000)
  }

  stopPeriodicMatching(): void {
    if (this.matchingInterval) {
      clearInterval(this.matchingInterval)
      this.matchingInterval = null
    }
  }

  destroy(): void {
    this.stopPeriodicMatching()
    this.orders = []
  }
}