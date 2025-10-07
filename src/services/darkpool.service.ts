import { PhantomPoolRealService } from './phantompool.real.service';

export interface OrderBookState {
  orders: any[];
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
  private phantomPoolService: PhantomPoolRealService;

  private constructor() {
    this.phantomPoolService = PhantomPoolRealService.getInstance();
    this.phantomPoolService.initialize().catch(console.error);
  }

  static getInstance(): DarkPoolService {
    if (!this.instance) {
      this.instance = new DarkPoolService();
    }
    return this.instance;
  }

  async submitOrder(orderData: any): Promise<{ success: boolean, orderId?: string, error?: string }> {
    try {
      const result = await this.phantomPoolService.submitOrder({
        walletAddress: orderData.walletAddress || 'demo-wallet',
        tokenPair: orderData.tokenPair || 'SOL/USDC',
        side: orderData.side || orderData.type?.toUpperCase() || 'BUY',
        amount: parseFloat(orderData.amount) || 0,
        limitPrice: parseFloat(orderData.price) || 150,
        signature: orderData.signature || 'demo-signature'
      });

      return {
        success: result.success,
        orderId: result.orderHash,
        error: result.error
      };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to submit order' 
      };
    }
  }

  async getOrderBook(): Promise<OrderBookState> {
    try {
      const state = await this.phantomPoolService.getOrderBookState();
      return {
        orders: [],
        totalVolume: BigInt(state.totalVolume || '0'),
        lastUpdate: state.lastUpdate,
        isMatching: state.isMatching
      };
    } catch (error) {
      return {
        orders: [],
        totalVolume: BigInt(0),
        lastUpdate: Date.now(),
        isMatching: false
      };
    }
  }

  async getExecutionHistory(): Promise<any[]> {
    return [];
  }

  async getPoolStats(): Promise<PoolStats> {
    try {
      const stats = await this.phantomPoolService.getLivePoolStats();
      return {
        totalOrders: stats.totalOrders,
        totalVolume: stats.totalVolume,
        activeTraders: stats.activeTraders,
        avgExecutionTime: stats.avgExecutionTime,
        privacyScore: stats.privacyScore
      };
    } catch (error) {
      return {
        totalOrders: 0,
        totalVolume: '0',
        activeTraders: 0,
        avgExecutionTime: 0,
        privacyScore: 0.95
      };
    }
  }

  on(event: string, callback: (...args: any[]) => void): void {
    this.phantomPoolService.on(event, callback);
  }

  off(event: string, callback: (...args: any[]) => void): void {
    this.phantomPoolService.off(event, callback);
  }
}