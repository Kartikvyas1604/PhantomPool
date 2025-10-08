import { PublicKey, Keypair } from '@solana/web3.js'
import { BlockchainService, OnChainOrder, OnChainMatchingRound } from './blockchain.service'
import { MatchingEngineRealService, MatchingResult } from '../crypto/matching.real.service'
import { ThresholdDecryptionRealService } from '../crypto/threshold.real.service'
import { VRFRealService } from '../crypto/vrf.real.service'

export interface MatchingRoundResult {
  roundId: number
  matches: Array<{
    buyOrderHash: string
    sellOrderHash: string
    amount: number
    clearingPrice: number
  }>
  clearingPrice: number
  totalVolume: number
  executedAt: number
}

export interface DecryptionRequest {
  orderHash: string
  encryptedAmount: Buffer
  encryptedPrice: Buffer
}

export class OnChainMatchingService {
  private static instance: OnChainMatchingService
  private blockchainService: BlockchainService
  private matchingEngine: MatchingEngineRealService
  private thresholdService: ThresholdDecryptionRealService
  private vrfService: VRFRealService
  
  private isMatching = false
  private currentRound: number = 0
  private matchingInterval: NodeJS.Timeout | null = null
  private authorityKeypair: Keypair
  
  private constructor() {
    this.blockchainService = BlockchainService.getInstance()
    this.matchingEngine = MatchingEngineRealService.getInstance()
    this.thresholdService = ThresholdDecryptionRealService.getInstance()
    this.vrfService = VRFRealService.getInstance()
    this.authorityKeypair = Keypair.generate()
  }

  static getInstance(): OnChainMatchingService {
    if (!this.instance) {
      this.instance = new OnChainMatchingService()
    }
    return this.instance
  }

  async initialize(): Promise<void> {
    await this.blockchainService.initialize()
    await this.matchingEngine.initialize()
    await this.thresholdService.initialize()
    
    this.startMatchingScheduler()
    this.subscribeToMatchingEvents()
  }

  async startMatchingRound(tokenPair: string): Promise<boolean> {
    if (this.isMatching) {
      console.log('Matching already in progress')
      return false
    }

    try {
      this.isMatching = true
      this.currentRound++

      console.log(`Starting matching round ${this.currentRound} for ${tokenPair}`)

      const poolAddress = await this.blockchainService.getPoolAddress(tokenPair)
      const pendingOrders = await this.blockchainService.getPendingOrders(poolAddress)

      if (pendingOrders.length < 2) {
        console.log('Not enough orders for matching')
        this.isMatching = false
        return false
      }

      const orderHashes = pendingOrders.map(order => Buffer.from(order.orderHash))
      const vrfInput = this.createVRFInput(orderHashes, this.currentRound)
      const vrfProof = await this.vrfService.generateProof(vrfInput)

      const txSignature = await this.blockchainService.startMatchingRound(
        poolAddress,
        this.currentRound,
        Buffer.from(vrfProof.proof),
        orderHashes,
        this.authorityKeypair
      )

      console.log('Matching round started on-chain:', txSignature)

      const decryptionRequests = this.createDecryptionRequests(pendingOrders)
      const decryptedOrders = await this.coordinateDecryption(decryptionRequests)

      if (decryptedOrders.length === 0) {
        console.log('No orders successfully decrypted')
        this.isMatching = false
        return false
      }

      const matchingResult = await this.executeMatching(decryptedOrders, vrfProof)
      
      if (matchingResult.matches.length > 0) {
        await this.settleMatches(poolAddress, matchingResult)
      }

      this.isMatching = false
      return true

    } catch (error) {
      console.error('Matching round failed:', error)
      this.isMatching = false
      return false
    }
  }

  private async coordinateDecryption(requests: DecryptionRequest[]): Promise<Array<{
    orderHash: string
    amount: number
    price: number
    side: 'buy' | 'sell'
  }>> {
    const decryptedOrders: Array<{
      orderHash: string
      amount: number
      price: number
      side: 'buy' | 'sell'
    }> = []

    for (const request of requests) {
      try {
        const decryptionRequest = {
          requestId: request.orderHash,
          ciphertext: {
            amount: request.encryptedAmount,
            price: request.encryptedPrice
          },
          threshold: 3,
          totalShares: 5,
          requiredExecutors: [1, 2, 3, 4, 5]
        }

        const result = await this.thresholdService.requestDecryption(decryptionRequest)
        
        if (result.success && result.decryptedData) {
          decryptedOrders.push({
            orderHash: request.orderHash,
            amount: parseInt(result.decryptedData.amount),
            price: parseInt(result.decryptedData.price),
            side: Math.random() > 0.5 ? 'buy' : 'sell'
          })
        }

      } catch (error) {
        console.error(`Failed to decrypt order ${request.orderHash}:`, error)
      }
    }

    return decryptedOrders
  }

  private async executeMatching(
    decryptedOrders: Array<{
      orderHash: string
      amount: number
      price: number
      side: 'buy' | 'sell'
    }>,
    vrfProof: any
  ): Promise<MatchingResult> {
    const buyOrders = decryptedOrders
      .filter(order => order.side === 'buy')
      .map(order => ({
        id: order.orderHash,
        price: order.price,
        amount: order.amount,
        timestamp: Date.now(),
        trader: 'anonymous'
      }))

    const sellOrders = decryptedOrders
      .filter(order => order.side === 'sell')
      .map(order => ({
        id: order.orderHash,
        price: order.price,
        amount: order.amount,
        timestamp: Date.now(),
        trader: 'anonymous'
      }))

    const shuffledBuys = await this.matchingEngine.shuffleOrdersWithVRF(buyOrders, vrfProof.randomness)
    const shuffledSells = await this.matchingEngine.shuffleOrdersWithVRF(sellOrders, vrfProof.randomness)

    return await this.matchingEngine.batchMatchOrders(shuffledBuys, shuffledSells)
  }

  private async settleMatches(
    poolAddress: PublicKey,
    matchingResult: MatchingResult
  ): Promise<void> {
    try {
      const matches = matchingResult.matches.map(match => ({
        buyOrderHash: Buffer.from(match.buyOrder.id, 'hex'),
        sellOrderHash: Buffer.from(match.sellOrder.id, 'hex'),
        amount: match.amount
      }))

      const matchingProof = Buffer.from(JSON.stringify({
        timestamp: Date.now(),
        matchCount: matches.length,
        clearingPrice: matchingResult.clearingPrice,
        totalVolume: matchingResult.totalVolume,
        fairnessScore: matchingResult.fairnessMetrics.overallScore
      }))

      const matchingRoundAddress = await this.getMatchingRoundAddress(poolAddress, this.currentRound)

      const txSignature = await this.blockchainService.executeMatches(
        matchingRoundAddress,
        poolAddress,
        matches,
        matchingResult.clearingPrice,
        matchingProof,
        this.authorityKeypair
      )

      console.log(`Settled ${matches.length} matches on-chain:`, txSignature)

    } catch (error) {
      console.error('Failed to settle matches:', error)
      throw error
    }
  }

  async getMatchingStatus(tokenPair: string): Promise<{
    isMatching: boolean
    currentRound: number
    nextRoundIn: number
    lastMatchingTime: number | null
  }> {
    try {
      const pool = await this.blockchainService.getPool(tokenPair)
      
      const nextRoundIn = this.isMatching ? 0 : 30

      return {
        isMatching: this.isMatching || (pool?.isMatchingActive || false),
        currentRound: this.currentRound,
        nextRoundIn,
        lastMatchingTime: null
      }

    } catch (error) {
      console.error('Failed to get matching status:', error)
      return {
        isMatching: false,
        currentRound: 0,
        nextRoundIn: 30,
        lastMatchingTime: null
      }
    }
  }

  async getMatchingHistory(tokenPair: string, limit: number = 10): Promise<MatchingRoundResult[]> {
    try {
      const poolAddress = await this.blockchainService.getPoolAddress(tokenPair)
      const results: MatchingRoundResult[] = []

      for (let i = Math.max(1, this.currentRound - limit); i <= this.currentRound; i++) {
        try {
          const round = await this.blockchainService.getMatchingRound(poolAddress, i)
          
          if (round && 'completed' in round.status) {
            results.push({
              roundId: round.roundId.toNumber(),
              matches: round.matches.map(match => ({
                buyOrderHash: Buffer.from(match.buyOrderHash).toString('hex'),
                sellOrderHash: Buffer.from(match.sellOrderHash).toString('hex'),
                amount: match.amount.toNumber(),
                clearingPrice: round.clearingPrice.toNumber()
              })),
              clearingPrice: round.clearingPrice.toNumber(),
              totalVolume: round.matches.reduce((sum, match) => 
                sum + match.amount.toNumber(), 0),
              executedAt: round.completedAt?.toNumber() || 0
            })
          }
        } catch (roundError) {
        }
      }

      return results.reverse()

    } catch (error) {
      console.error('Failed to get matching history:', error)
      return []
    }
  }

  private startMatchingScheduler(): void {
    const interval = parseInt(process.env.MATCHING_INTERVAL || '30000')
    
    this.matchingInterval = setInterval(async () => {
      if (!this.isMatching) {
        try {
          const supportedPairs = ['SOL/USDC', 'ETH/USDC', 'BTC/USDC']
          
          for (const pair of supportedPairs) {
            const poolAddress = await this.blockchainService.getPoolAddress(pair)
            const pendingOrders = await this.blockchainService.getPendingOrders(poolAddress)
            
            if (pendingOrders.length >= 2) {
              console.log(`Triggering matching for ${pair} with ${pendingOrders.length} orders`)
              await this.startMatchingRound(pair)
              break
            }
          }
        } catch (error) {
          console.error('Scheduled matching failed:', error)
        }
      }
    }, interval)
  }

  private subscribeToMatchingEvents(): void {
    this.blockchainService.subscribeToMatchingEvents((event) => {
      console.log('Matching event received:', event)
      
      if (event.name === 'MatchingRoundStarted') {
        console.log(`Matching round ${event.data.roundId} started for pool ${event.data.pool}`)
      } else if (event.name === 'TradeExecuted') {
        console.log(`Trade executed: ${event.data.amount} at price ${event.data.price}`)
      }
    })
  }

  private createDecryptionRequests(orders: OnChainOrder[]): DecryptionRequest[] {
    return orders.map(order => ({
      orderHash: Buffer.from(order.orderHash).toString('hex'),
      encryptedAmount: Buffer.from(order.encryptedAmount),
      encryptedPrice: Buffer.from(order.encryptedPrice)
    }))
  }

  private createVRFInput(orderHashes: Buffer[], roundNumber: number): Buffer {
    const combined = Buffer.concat([
      Buffer.from(roundNumber.toString()),
      ...orderHashes,
      Buffer.from(Date.now().toString())
    ])
    return combined
  }

  private async getMatchingRoundAddress(poolAddress: PublicKey, roundId: number): Promise<PublicKey> {
    const [matchingRoundPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("round"),
        poolAddress.toBuffer(),
        Buffer.from(roundId.toString())
      ],
      this.blockchainService.getProgramId()
    )
    return matchingRoundPda
  }

  async forceStopMatching(): Promise<void> {
    this.isMatching = false
    console.log('Matching forcefully stopped')
  }

  async getExecutorStatus(): Promise<Array<{
    executorId: number
    isActive: boolean
    totalDecryptions: number
    lastSeen: number
  }>> {
    try {
      const executors = await this.blockchainService.getExecutorNodes()
      
      return executors.map(executor => ({
        executorId: executor.executorId,
        isActive: executor.isActive,
        totalDecryptions: executor.totalDecryptions.toNumber(),
        lastSeen: executor.registeredAt.toNumber()
      }))

    } catch (error) {
      console.error('Failed to get executor status:', error)
      return []
    }
  }

  destroy(): void {
    if (this.matchingInterval) {
      clearInterval(this.matchingInterval)
      this.matchingInterval = null
    }
    this.isMatching = false
  }
}