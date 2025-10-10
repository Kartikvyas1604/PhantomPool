import { apiClient } from './api.client';

export interface Order {
  id: string;
  orderHash: string;
  side: 'BUY' | 'SELL';
  timestamp: number;
  encryptedAmount: Record<string, unknown>;
  encryptedPrice: Record<string, unknown>;
}

export interface OrderBookState {
  orders: Order[];
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

export interface OrderData {
  walletAddress?: string;
  tokenPair?: string;
  side?: 'BUY' | 'SELL';
  type?: string;
  amount?: string | number;
  price?: string | number;
  balance?: string | number;
  signature?: string;
}

export class DarkPoolService {
  private static instance: DarkPoolService;
  private eventListeners: Map<string, ((data?: unknown) => void)[]> = new Map();

  private constructor() {
    // Initialize service
  }

  static getInstance(): DarkPoolService {
    if (!this.instance) {
      this.instance = new DarkPoolService();
    }
    return this.instance;
  }

  async submitOrder(orderData: OrderData): Promise<{ success: boolean, orderId?: string, error?: string }> {
    try {
      const result = await apiClient.submitOrder({
        walletAddress: orderData.walletAddress || 'demo-wallet',
        tokenPair: orderData.tokenPair || 'SOL-USDC',
        side: orderData.side || (orderData.type?.toUpperCase() as 'BUY' | 'SELL') || 'BUY',
        amount: parseFloat(String(orderData.amount)) || 0,
        limitPrice: parseFloat(String(orderData.price)) || 150,
        balance: parseFloat(String(orderData.balance)) || 1000,
        signature: orderData.signature || 'demo-signature'
      });

      const typedResult = result as { success: boolean; orderHash: string; error?: string };
      return {
        success: typedResult.success,
        orderId: typedResult.orderHash,
        error: typedResult.error
      };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to submit order' 
      };
    }
  }

  async getOrderBook(tokenPair: string = 'SOL-USDC'): Promise<OrderBookState> {
    try {
      const response = await apiClient.getOrderBook(tokenPair) as { orders: Order[]; totalVolume?: string };
      return {
        orders: response.orders || [],
        totalVolume: BigInt(response.totalVolume || '0'),
        lastUpdate: Date.now(),
        isMatching: false
      };
    } catch (_error) {
      return {
        orders: [],
        totalVolume: BigInt(0),
        lastUpdate: Date.now(),
        isMatching: false
      };
    }
  }

  async getMatchingStatus() {
    try {
      return await apiClient.getMatchingStatus();
    } catch (_error) {
      return {
        isMatching: false,
        nextRoundIn: 30,
        lastRound: {
          completedAt: Date.now() - 30000,
          matchedOrders: 0,
          clearingPrice: 0
        }
      };
    }
  }

  async getExecutionHistory(): Promise<Record<string, unknown>[]> {
    try {
      const response = await apiClient.getMatchingHistory(20) as { rounds: Record<string, unknown>[] };
      return response.rounds || [];
    } catch (_error) {
      return [];
    }
  }

  async getPoolStats(): Promise<PoolStats> {
    try {
      const [volumeData, executorStats, systemStatus] = await Promise.all([
        apiClient.getVolumeData('24h'),
        apiClient.getExecutorStats(),
        apiClient.getSystemStatus()
      ]);

      const typedVolumeData = volumeData as { totalTrades?: number; volume?: string };
      const typedExecutorStats = executorStats as { executors?: unknown[] };
      const typedSystemStatus = systemStatus as { avgResponseTime?: number };

      return {
        totalOrders: typedVolumeData.totalTrades || 0,
        totalVolume: typedVolumeData.volume || '0',
        activeTraders: typedExecutorStats.executors?.length || 0,
        avgExecutionTime: typedSystemStatus.avgResponseTime || 0,
        privacyScore: 0.95
      };
    } catch (_error) {
      return {
        totalOrders: 0,
        totalVolume: '0',
        activeTraders: 0,
        avgExecutionTime: 0,
        privacyScore: 0.95
      };
    }
  }

  on(event: string, callback: (data?: unknown) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  off(event: string, callback: (data?: unknown) => void): void {
    if (this.eventListeners.has(event)) {
      const listeners = this.eventListeners.get(event)!;
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }
}