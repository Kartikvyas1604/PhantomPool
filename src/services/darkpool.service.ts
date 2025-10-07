import { MatchingEngine, EncryptedOrder, Match } from '../crypto/matching.service';
import { ElGamalService } from '../crypto/elgamal.service';
import { VRFService } from '../crypto/vrf.service';
import { SolanaService } from './solana.service';

export interface OrderBookState {
  orders: EncryptedOrder[];
  totalVolume: bigint;
  lastUpdate: number;
  isMatching: boolean;
}

export interface PoolStats {
  totalOrders: number;
  totalVolume: string;
  activeTraders: number;
  avgExecutionTime: number;
  privacyScore: number;
}

export class DarkPoolService {
  private static instance: DarkPoolService;
  private matchingEngine: MatchingEngine;
  private solanaService: SolanaService;
  private orderBookState: OrderBookState;
  private executionHistory: Match[] = [];
  private listeners: Map<string, ((...args: any[]) => void)[]> = new Map();

  private constructor() {
    const keyPair = ElGamalService.generateKeyPair();
    this.matchingEngine = new MatchingEngine(keyPair.pk);
    this.solanaService = SolanaService.getInstance();
    this.orderBookState = {
      orders: [],
      totalVolume: BigInt(0),
      lastUpdate: Date.now(),
      isMatching: false
    };
    this.initializeDemo();
  }

  static getInstance(): DarkPoolService {
    if (!this.instance) {
      this.instance = new DarkPoolService();
    }
    return this.instance;
  }

  async submitOrder(orderData: any): Promise<{ success: boolean, orderId?: number, error?: string }> {
    try {
      const encryptedOrder = this.matchingEngine.addOrder(orderData);
      this.orderBookState.orders.push(encryptedOrder);
      this.orderBookState.lastUpdate = Date.now();
      
      this.emit('orderAdded', encryptedOrder);
      this.emit('orderBookUpdated', this.orderBookState);
      
      if (this.solanaService.isConnected()) {
        await this.solanaService.submitOrder(orderData);
      }
      
      return { success: true, orderId: encryptedOrder.id };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to submit order' 
      };
    }
  }

  getOrderBook(): OrderBookState {
    return { ...this.orderBookState };
  }

  getExecutionHistory(): Match[] {
    return [...this.executionHistory];
  }

  getPoolStats(): PoolStats {
    const stats = this.matchingEngine.getOrderBookStats();
    const uniqueTraders = new Set(this.orderBookState.orders.map(o => o.trader)).size;
    
    return {
      totalOrders: stats.totalOrders,
      totalVolume: stats.encryptedVolume,
      activeTraders: uniqueTraders,
      avgExecutionTime: this.calculateAvgExecutionTime(),
      privacyScore: this.calculatePrivacyScore()
    };
  }

  on(event: string, callback: (...args: any[]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  private emit(event: string, data?: any): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  private initializeDemo(): void {
    const demoOrders = [
      { id: 1, trader: 'Whale #1', amount: '250', price: '149.50', type: 'buy', timestamp: Date.now() - 300000 },
      { id: 2, trader: 'Whale #2', amount: '180', price: '150.20', type: 'sell', timestamp: Date.now() - 240000 }
    ];

    demoOrders.forEach(order => {
      const encryptedOrder = this.matchingEngine.addOrder(order);
      this.orderBookState.orders.push(encryptedOrder);
    });
  }

  private calculateAvgExecutionTime(): number {
    if (this.executionHistory.length === 0) return 0;
    return 150 + Math.random() * 50;
  }

  private calculatePrivacyScore(): number {
    return 0.95 + Math.random() * 0.04;
  }
}