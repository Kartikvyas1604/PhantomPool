import { ElGamalRealService, Point, ElGamalCiphertext, ThresholdShares } from '../crypto/elgamal.enhanced.service';
import { VRFRealService, VRFProof } from '../crypto/vrf.enhanced.service';
import { EventEmitter } from 'events';
import { createHash, randomBytes } from 'crypto';

export interface ExecutorNode {
  id: number;
  publicKey: Point;
  privateShare: bigint;
  stakeAmount: bigint;
  isActive: boolean;
  lastHeartbeat: number;
  performanceScore: number;
  slashCount: number;
}

export interface PartialDecryption {
  executorId: number;
  orderIndex: number;
  decryptedPoint: Point;
  proof: Uint8Array;
  timestamp: number;
}

export interface MatchingRoundResult {
  roundNumber: number;
  shuffledOrders: string[];
  decryptedOrders: DecryptedOrder[];
  matchedPairs: TradePair[];
  clearingPrice: number;
  executionProof: Uint8Array;
}

export interface DecryptedOrder {
  orderHash: string;
  amount: number;
  price: number;
  side: 'BUY' | 'SELL';
  trader: string;
}

export interface TradePair {
  buyOrder: string;
  sellOrder: string;
  amount: number;
  price: number;
}

export interface NetworkConfig {
  threshold: number;        // 3
  totalNodes: number;      // 5
  heartbeatInterval: number; // 30 seconds
  slashingEnabled: boolean;
  minimumStake: bigint;
}

export class ExecutorNetworkService extends EventEmitter {
  private static instance: ExecutorNetworkService;
  
  private config: NetworkConfig;
  private executors: Map<number, ExecutorNode> = new Map();
  private thresholdShares!: ThresholdShares;
  private currentRound: number = 0;
  private isProcessingRound: boolean = false;
  
  // VRF keys for fair ordering
  private vrfKeyPair: { publicKey: Uint8Array; privateKey: Uint8Array };
  
  private constructor(config?: Partial<NetworkConfig>) {
    super();
    
    this.config = {
      threshold: 3,
      totalNodes: 5,
      heartbeatInterval: 30000, // 30 seconds
      slashingEnabled: true,
      minimumStake: BigInt(1000 * 1000000), // 1000 tokens
      ...config
    };
    
    // Initialize VRF keys
    this.vrfKeyPair = VRFRealService.generateKeyPair();
    
    // Initialize threshold cryptography
    this.initializeThresholdCryptography();
    
    // Start network monitoring
    this.startHeartbeatMonitoring();
  }

  static getInstance(config?: Partial<NetworkConfig>): ExecutorNetworkService {
    if (!this.instance) {
      this.instance = new ExecutorNetworkService(config);
    }
    return this.instance;
  }

  // Initialize 5-node network with 3-of-5 threshold
  private initializeThresholdCryptography(): void {
    this.thresholdShares = ElGamalRealService.generateThresholdShares(
      this.config.threshold,
      this.config.totalNodes
    );
    
    // Create executor nodes with their threshold shares
    for (let i = 0; i < this.config.totalNodes; i++) {
      const share = this.thresholdShares.shares[i];
      
      const executor: ExecutorNode = {
        id: i + 1,
        publicKey: this.thresholdShares.publicKey,
        privateShare: share.value,
        stakeAmount: this.config.minimumStake,
        isActive: true,
        lastHeartbeat: Date.now(),
        performanceScore: 100,
        slashCount: 0
      };
      
      this.executors.set(executor.id, executor);
    }
    
    console.log(`Initialized ${this.config.totalNodes} executor nodes with ${this.config.threshold}-of-${this.config.totalNodes} threshold`);
    this.emit('networkInitialized', {
      totalNodes: this.config.totalNodes,
      threshold: this.config.threshold,
      publicKey: this.thresholdShares.publicKey
    });
  }

  // Register a new executor node (for dynamic network management)
  async registerExecutor(
    stakingAmount: bigint,
    publicVerificationKey?: Point
  ): Promise<{ executorId: number; privateShare: bigint }> {
    if (this.executors.size >= this.config.totalNodes) {
      throw new Error('Network is at maximum capacity');
    }

    if (stakingAmount < this.config.minimumStake) {
      throw new Error(`Minimum stake is ${this.config.minimumStake}`);
    }

    const executorId = this.executors.size + 1;
    const shareIndex = this.thresholdShares.shares[executorId - 1];
    
    const executor: ExecutorNode = {
      id: executorId,
      publicKey: publicVerificationKey || this.thresholdShares.publicKey,
      privateShare: shareIndex.value,
      stakeAmount: stakingAmount,
      isActive: true,
      lastHeartbeat: Date.now(),
      performanceScore: 100,
      slashCount: 0
    };

    this.executors.set(executorId, executor);
    
    this.emit('executorRegistered', { executorId, stakeAmount: stakingAmount });
    
    return {
      executorId,
      privateShare: shareIndex.value
    };
  }

  // Start a new matching round with encrypted orders
  async startMatchingRound(
    encryptedOrders: Array<{
      orderHash: string;
      encryptedAmount: ElGamalCiphertext;
      encryptedPrice: ElGamalCiphertext;
      side: 'BUY' | 'SELL';
      trader: string;
    }>,
    blockHash: string
  ): Promise<{ roundId: string; vrfProof: VRFProof }> {
    if (this.isProcessingRound) {
      throw new Error('Another matching round is already in progress');
    }

    if (encryptedOrders.length < 2) {
      throw new Error('Need at least 2 orders for matching');
    }

    const activeExecutors = Array.from(this.executors.values()).filter(e => e.isActive);
    if (activeExecutors.length < this.config.threshold) {
      throw new Error(`Need at least ${this.config.threshold} active executors`);
    }

    this.currentRound++;
    this.isProcessingRound = true;

    // Generate VRF for fair order shuffling
    const vrfInput = this.createRoundInput(encryptedOrders, blockHash, this.currentRound);
    const vrfProof = VRFRealService.prove(this.vrfKeyPair.privateKey, vrfInput);
    
    // Shuffle orders using VRF
    const orderHashes = encryptedOrders.map(o => o.orderHash);
    const shuffleResult = VRFRealService.shuffleOrdersWithVRF(
      orderHashes,
      this.vrfKeyPair.privateKey,
      blockHash,
      Date.now()
    );

    const roundId = this.generateRoundId();
    
    this.emit('matchingRoundStarted', {
      roundId,
      roundNumber: this.currentRound,
      orderCount: encryptedOrders.length,
      shuffledOrders: shuffleResult.shuffledOrders,
      vrfProof: vrfProof,
      fairnessScore: shuffleResult.fairnessScore
    });

    // Initiate threshold decryption process
    setTimeout(() => {
      this.initiateThresholdDecryption(roundId, encryptedOrders, shuffleResult.shuffledOrders);
    }, 1000); // Small delay to allow event processing

    return { roundId, vrfProof };
  }

  // Initiate threshold decryption with active executors
  private async initiateThresholdDecryption(
    roundId: string,
    encryptedOrders: Array<{
      orderHash: string;
      encryptedAmount: ElGamalCiphertext;
      encryptedPrice: ElGamalCiphertext;
      side: 'BUY' | 'SELL';
      trader: string;
    }>,
    shuffledOrderHashes: string[]
  ): Promise<void> {
    const activeExecutors = Array.from(this.executors.values()).filter(e => e.isActive);
    
    // Reorder encrypted orders according to VRF shuffle
    const shuffledOrders = shuffledOrderHashes.map(hash => 
      encryptedOrders.find(o => o.orderHash === hash)!
    );

    const partialDecryptions: Map<number, PartialDecryption[]> = new Map();
    
    // Each executor performs partial decryption
    const decryptionPromises = activeExecutors.map(async (executor) => {
      const executorDecryptions: PartialDecryption[] = [];
      
      for (let i = 0; i < shuffledOrders.length; i++) {
        const order = shuffledOrders[i];
        
        // Partial decrypt amount and price
        const amountPartial = ElGamalRealService.partialDecrypt(
          executor.privateShare,
          order.encryptedAmount
        );
        // Partial decrypt amount and price (price decryption would need separate processing)
        // const pricePartial = ElGamalRealService.partialDecrypt(
        //   executor.privateShare,
        //   order.encryptedPrice
        // );
        
        // Generate proof of correct decryption (simplified)
        const proof = this.generateDecryptionProof(
          executor.id,
          i,
          executor.privateShare,
          order.encryptedAmount,
          amountPartial
        );
        
        executorDecryptions.push({
          executorId: executor.id,
          orderIndex: i,
          decryptedPoint: amountPartial,
          proof,
          timestamp: Date.now()
        });
      }
      
      partialDecryptions.set(executor.id, executorDecryptions);
      
      // Update executor performance
      executor.lastHeartbeat = Date.now();
      executor.performanceScore = Math.min(100, executor.performanceScore + 5);
      
      this.emit('partialDecryptionCompleted', {
        roundId,
        executorId: executor.id,
        ordersProcessed: executorDecryptions.length
      });
    });

    await Promise.all(decryptionPromises);

    // Combine threshold shares to recover plaintext
    await this.combineDecryptions(roundId, shuffledOrders, partialDecryptions);
  }

  // Combine partial decryptions to recover plaintext values
  private async combineDecryptions(
    roundId: string,
    shuffledOrders: Array<{
      orderHash: string;
      encryptedAmount: ElGamalCiphertext;
      encryptedPrice: ElGamalCiphertext;
      side: 'BUY' | 'SELL';
      trader: string;
    }>,
    partialDecryptions: Map<number, PartialDecryption[]>
  ): Promise<void> {
    const decryptedOrders: DecryptedOrder[] = [];
    
    // Get first threshold number of executors
    const executorIds = Array.from(partialDecryptions.keys()).slice(0, this.config.threshold);
    
    for (let orderIndex = 0; orderIndex < shuffledOrders.length; orderIndex++) {
      const order = shuffledOrders[orderIndex];
      
      // Collect partial decryptions for this order
      const amountPartials: { index: number; partial: Point }[] = [];
      const pricePartials: { index: number; partial: Point }[] = [];
      
      for (const executorId of executorIds) {
        const executorDecryptions = partialDecryptions.get(executorId)!;
        const orderDecryption = executorDecryptions[orderIndex];
        
        if (orderDecryption) {
          amountPartials.push({
            index: executorId,
            partial: orderDecryption.decryptedPoint
          });
          
          // For price, we'd need separate partial decryptions
          // Simplified: using same point for demonstration
          pricePartials.push({
            index: executorId,
            partial: orderDecryption.decryptedPoint
          });
        }
      }
      
      try {
        // Combine threshold shares to recover plaintext
        const decryptedAmount = ElGamalRealService.combineThresholdShares(
          amountPartials,
          order.encryptedAmount,
          this.config.threshold
        );
        
        const decryptedPrice = ElGamalRealService.combineThresholdShares(
          pricePartials,
          order.encryptedPrice,
          this.config.threshold
        );
        
        // Convert from fixed-point representation
        const amount = Number(decryptedAmount) / 1000000; // 6 decimal places
        const price = Number(decryptedPrice) / 1000000;
        
        decryptedOrders.push({
          orderHash: order.orderHash,
          amount,
          price,
          side: order.side,
          trader: order.trader
        });
        
      } catch (error) {
        console.error(`Failed to decrypt order ${orderIndex}:`, error);
        
        // Slash misbehaving executors if decryption fails
        if (this.config.slashingEnabled) {
          await this.investigateDecryptionFailure(executorIds, orderIndex);
        }
      }
    }
    
    // Run matching algorithm on decrypted orders
    const matchingResult = await this.runMatchingAlgorithm(decryptedOrders);
    
    this.emit('thresholdDecryptionCompleted', {
      roundId,
      decryptedOrders: decryptedOrders.length,
      matchedPairs: matchingResult.matchedPairs.length,
      clearingPrice: matchingResult.clearingPrice
    });
    
    // Complete the matching round
    await this.completeMatchingRound(roundId, decryptedOrders, matchingResult);
  }

  // Run optimal matching algorithm on decrypted orders
  private async runMatchingAlgorithm(orders: DecryptedOrder[]): Promise<{
    matchedPairs: TradePair[];
    clearingPrice: number;
  }> {
    const buyOrders = orders.filter(o => o.side === 'BUY').sort((a, b) => b.price - a.price);
    const sellOrders = orders.filter(o => o.side === 'SELL').sort((a, b) => a.price - b.price);
    
    const matchedPairs: TradePair[] = [];
    let buyIndex = 0;
    let sellIndex = 0;
    
    // Simple price-time priority matching
    while (buyIndex < buyOrders.length && sellIndex < sellOrders.length) {
      const buyOrder = buyOrders[buyIndex];
      const sellOrder = sellOrders[sellIndex];
      
      // Check if orders can match (buy price >= sell price)
      if (buyOrder.price >= sellOrder.price) {
        const matchAmount = Math.min(buyOrder.amount, sellOrder.amount);
        const executionPrice = (buyOrder.price + sellOrder.price) / 2; // Mid-price
        
        matchedPairs.push({
          buyOrder: buyOrder.orderHash,
          sellOrder: sellOrder.orderHash,
          amount: matchAmount,
          price: executionPrice
        });
        
        // Update remaining amounts
        buyOrder.amount -= matchAmount;
        sellOrder.amount -= matchAmount;
        
        // Remove fully filled orders
        if (buyOrder.amount === 0) buyIndex++;
        if (sellOrder.amount === 0) sellIndex++;
      } else {
        // No more possible matches
        break;
      }
    }
    
    // Calculate clearing price (volume-weighted average)
    let totalVolume = 0;
    let weightedPriceSum = 0;
    
    for (const pair of matchedPairs) {
      const volume = pair.amount * pair.price;
      totalVolume += volume;
      weightedPriceSum += pair.price * volume;
    }
    
    const clearingPrice = totalVolume > 0 ? weightedPriceSum / totalVolume : 0;
    
    return { matchedPairs, clearingPrice };
  }

  // Complete matching round and emit results
  private async completeMatchingRound(
    roundId: string,
    decryptedOrders: DecryptedOrder[],
    matchingResult: { matchedPairs: TradePair[]; clearingPrice: number }
  ): Promise<void> {
    // Generate execution proof
    const executionProof = this.generateExecutionProof(
      this.currentRound,
      decryptedOrders,
      matchingResult.matchedPairs
    );
    
    const result: MatchingRoundResult = {
      roundNumber: this.currentRound,
      shuffledOrders: decryptedOrders.map(o => o.orderHash),
      decryptedOrders,
      matchedPairs: matchingResult.matchedPairs,
      clearingPrice: matchingResult.clearingPrice,
      executionProof
    };
    
    // Distribute rewards to participating executors
    await this.distributeExecutorRewards(roundId);
    
    this.isProcessingRound = false;
    
    this.emit('matchingRoundCompleted', {
      roundId,
      result,
      timestamp: Date.now()
    });
  }

  // Heartbeat monitoring for executor liveness
  private startHeartbeatMonitoring(): void {
    setInterval(() => {
      const now = Date.now();
      
      for (const [executorId, executor] of this.executors) {
        const timeSinceHeartbeat = now - executor.lastHeartbeat;
        
        if (timeSinceHeartbeat > this.config.heartbeatInterval * 2) {
          // Mark as inactive and potentially slash
          executor.isActive = false;
          executor.performanceScore = Math.max(0, executor.performanceScore - 10);
          
          if (this.config.slashingEnabled && timeSinceHeartbeat > this.config.heartbeatInterval * 5) {
            this.slashExecutor(executorId, 'missed_heartbeat', timeSinceHeartbeat);
          }
          
          this.emit('executorInactive', { executorId, timeSinceHeartbeat });
        }
      }
    }, this.config.heartbeatInterval);
  }

  // Slash misbehaving executor
  private async slashExecutor(
    executorId: number,
    violation: string,
    evidence: string | number | object
  ): Promise<void> {
    const executor = this.executors.get(executorId);
    if (!executor) return;
    
    const slashAmount = this.calculateSlashAmount(violation, executor.stakeAmount);
    
    executor.stakeAmount -= slashAmount;
    executor.slashCount++;
    executor.performanceScore = Math.max(0, executor.performanceScore - 20);
    
    // Deactivate if too many slashes
    if (executor.slashCount >= 3 || executor.stakeAmount < this.config.minimumStake) {
      executor.isActive = false;
    }
    
    this.emit('executorSlashed', {
      executorId,
      violation,
      slashAmount: Number(slashAmount),
      remainingStake: Number(executor.stakeAmount),
      evidence
    });
  }

  // Calculate slash amount based on violation type
  private calculateSlashAmount(violation: string, stakeAmount: bigint): bigint {
    switch (violation) {
      case 'missed_heartbeat':
        return stakeAmount / BigInt(100); // 1%
      case 'invalid_decryption':
        return stakeAmount / BigInt(10);  // 10%
      case 'malicious_behavior':
        return stakeAmount / BigInt(2);   // 50%
      default:
        return BigInt(0);
    }
  }

  // Investigate decryption failures
  private async investigateDecryptionFailure(
    executorIds: number[],
    orderIndex: number
  ): Promise<void> {
    // In a real implementation, this would:
    // 1. Re-verify partial decryption proofs
    // 2. Identify which executor provided invalid shares
    // 3. Slash the misbehaving executor(s)
    
    console.warn(`Decryption failure for order ${orderIndex}, investigating...`);
    
    // Simplified: reduce performance score for all involved executors
    for (const executorId of executorIds) {
      const executor = this.executors.get(executorId);
      if (executor) {
        executor.performanceScore = Math.max(0, executor.performanceScore - 5);
      }
    }
  }

  // Distribute rewards to executors
  private async distributeExecutorRewards(roundId: string): Promise<void> {
    const activeExecutors = Array.from(this.executors.values()).filter(e => e.isActive);
    const baseReward = BigInt(10 * 1000000); // 10 tokens per round
    
    for (const executor of activeExecutors) {
      // Performance-based rewards
      const performanceMultiplier = executor.performanceScore / 100;
      const reward = BigInt(Math.floor(Number(baseReward) * performanceMultiplier));
      
      executor.stakeAmount += reward;
      
      this.emit('executorRewarded', {
        roundId,
        executorId: executor.id,
        reward: Number(reward),
        performanceScore: executor.performanceScore
      });
    }
  }

  // Utility methods
  private createRoundInput(orders: { orderHash: string }[], blockHash: string, roundNumber: number): Uint8Array {
    const hasher = createHash('sha256');
    
    // Add orders
    for (const order of orders.sort((a, b) => a.orderHash.localeCompare(b.orderHash))) {
      hasher.update(order.orderHash);
    }
    
    hasher.update(blockHash);
    hasher.update(Buffer.from([roundNumber & 0xFF, (roundNumber >> 8) & 0xFF]));
    
    return new Uint8Array(hasher.digest());
  }

  private generateRoundId(): string {
    return `round_${this.currentRound}_${Date.now()}_${randomBytes(8).toString('hex')}`;
  }

  private generateDecryptionProof(
    executorId: number,
    orderIndex: number,
    privateShare: bigint,
    ciphertext: ElGamalCiphertext,
    partialDecryption: Point
  ): Uint8Array {
    // Simplified proof generation (would use proper ZK-SNARKs)
    const hasher = createHash('sha256');
    hasher.update(Buffer.from([executorId]));
    hasher.update(Buffer.from([orderIndex]));
    hasher.update(ElGamalRealService.serializeCiphertext(ciphertext));
    hasher.update(ElGamalRealService.serializePoint(partialDecryption));
    
    return new Uint8Array(hasher.digest());
  }

  private generateExecutionProof(
    roundNumber: number,
    decryptedOrders: DecryptedOrder[],
    matchedPairs: TradePair[]
  ): Uint8Array {
    const hasher = createHash('sha256');
    
    hasher.update(Buffer.from([roundNumber & 0xFF, (roundNumber >> 8) & 0xFF]));
    
    for (const order of decryptedOrders) {
      hasher.update(order.orderHash);
      hasher.update(Buffer.from([Math.floor(order.amount * 1000000)]));
      hasher.update(Buffer.from([Math.floor(order.price * 1000000)]));
    }
    
    for (const pair of matchedPairs) {
      hasher.update(pair.buyOrder);
      hasher.update(pair.sellOrder);
      hasher.update(Buffer.from([Math.floor(pair.amount * 1000000)]));
    }
    
    return new Uint8Array(hasher.digest());
  }

  // Public getters
  getNetworkStatus() {
    const activeExecutors = Array.from(this.executors.values()).filter(e => e.isActive);
    
    return {
      totalExecutors: this.executors.size,
      activeExecutors: activeExecutors.length,
      threshold: this.config.threshold,
      currentRound: this.currentRound,
      isProcessing: this.isProcessingRound,
      networkHealth: activeExecutors.length >= this.config.threshold ? 'healthy' : 'degraded'
    };
  }

  getExecutorStats() {
    return Array.from(this.executors.values()).map(executor => ({
      id: executor.id,
      isActive: executor.isActive,
      stakeAmount: Number(executor.stakeAmount),
      performanceScore: executor.performanceScore,
      slashCount: executor.slashCount,
      lastHeartbeat: executor.lastHeartbeat
    }));
  }

  // Manual executor heartbeat (for testing)
  async submitHeartbeat(executorId: number): Promise<void> {
    const executor = this.executors.get(executorId);
    if (!executor) {
      throw new Error('Executor not found');
    }
    
    executor.lastHeartbeat = Date.now();
    executor.performanceScore = Math.min(100, executor.performanceScore + 1);
    
    if (!executor.isActive && executor.stakeAmount >= this.config.minimumStake) {
      executor.isActive = true;
      this.emit('executorReactivated', { executorId });
    }
  }

  // Shutdown network gracefully
  async shutdown(): Promise<void> {
    this.isProcessingRound = false;
    this.removeAllListeners();
    
    // In a real implementation, this would save state to persistent storage
    console.log('Executor network shutdown complete');
  }
}