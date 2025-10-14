export interface OrderSubmission {
  tokenPair: string;
  side: 'BUY' | 'SELL';
  amount: string;
  price: string;
  walletAddress: string;
  balance: string;
  signature: string;
}

export interface OrderResult {
  success: boolean;
  orderId?: string;
  error?: string;
  txSignature?: string;
}

export interface PoolStats {
  totalVolume: string;
  totalOrders: number;
  activeTraders: number;
  lastClearingPrice: number;
}

export interface MatchingStatus {
  isMatching: boolean;
  nextRoundIn: number;
  lastRound?: {
    clearingPrice?: number;
  };
}

export class DarkPoolService {
  private static instance: DarkPoolService;

  private constructor() {}

  public static getInstance(): DarkPoolService {
    if (!DarkPoolService.instance) {
      DarkPoolService.instance = new DarkPoolService();
    }
    return DarkPoolService.instance;
  }

  async submitOrder(order: OrderSubmission): Promise<OrderResult> {
    try {
      const orderId = this.generateOrderId(order);
      return {
        success: true,
        orderId,
        txSignature: `tx_${orderId}`
      };
    } catch (error) {
      console.error('Order submission failed:', error);
      return {
        success: false,
        error: 'Order submission failed'
      };
    }
  }

  async getMatchingStatus(): Promise<MatchingStatus> {
    const currentTime = Date.now();
    const roundDuration = 30000;
    const timeInRound = currentTime % roundDuration;
    const nextRoundIn = Math.floor((roundDuration - timeInRound) / 1000);

    return {
      isMatching: timeInRound > 25000,
      nextRoundIn,
      lastRound: {
        clearingPrice: 142.50
      }
    };
  }

  async getPoolStats(): Promise<PoolStats> {
    return {
      totalVolume: (Math.random() * 10000000 + 5000000).toString(),
      totalOrders: Math.floor(Math.random() * 150 + 50),
      activeTraders: Math.floor(Math.random() * 10 + 15),
      lastClearingPrice: 142.50 + (Math.random() - 0.5) * 5
    };
  }

  private generateOrderId(order: OrderSubmission): string {
    const timestamp = Date.now();
    const data = `${order.walletAddress}-${order.tokenPair}-${order.side}-${timestamp}`;
    
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return `order_${Math.abs(hash).toString(16)}`;
  }
}
