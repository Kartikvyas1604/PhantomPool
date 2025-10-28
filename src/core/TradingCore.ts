import { Connection, PublicKey, Transaction } from '@solana/web3.js';

interface TradeOrder {
  id: string;
  type: 'buy' | 'sell';
  amount: number;
  price: number;
  timestamp: number;
  walletAddress: string;
}

interface MarketData {
  price: number;
  volume24h: number;
  change24h: number;
  lastUpdated: number;
}

interface MatchingResult {
  clearingPrice: number;
  matchedOrders: TradeOrder[];
  totalVolume: number;
  timestamp: number;
}

class TradingCore {
  private connection: Connection;
  private orders: Map<string, TradeOrder> = new Map();
  private marketData: MarketData | null = null;
  private isMatching = false;
  private matchingInterval = 30000;

  constructor() {
    this.connection = new Connection('https://api.mainnet-beta.solana.com');
    this.startMatchingCycle();
  }

  async submitOrder(order: Omit<TradeOrder, 'id' | 'timestamp'>): Promise<string> {
    const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fullOrder: TradeOrder = {
      ...order,
      id: orderId,
      timestamp: Date.now()
    };

    this.orders.set(orderId, fullOrder);
    return orderId;
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    return this.orders.delete(orderId);
  }

  getOrderBook() {
    const buyOrders = Array.from(this.orders.values())
      .filter(order => order.type === 'buy')
      .sort((a, b) => b.price - a.price);
    
    const sellOrders = Array.from(this.orders.values())
      .filter(order => order.type === 'sell')
      .sort((a, b) => a.price - b.price);

    return { buyOrders, sellOrders };
  }

  async updateMarketData(): Promise<MarketData> {
    try {
      const response = await fetch('/api/price');
      const data = await response.json();
      
      this.marketData = {
        price: data.sol?.price || 0,
        volume24h: data.sol?.volume24h || 0,
        change24h: data.sol?.change24h || 0,
        lastUpdated: Date.now()
      };

      return this.marketData;
    } catch (error) {
      throw new Error('Failed to fetch market data');
    }
  }

  private startMatchingCycle() {
    setInterval(async () => {
      if (!this.isMatching && this.orders.size > 0) {
        await this.executeMatching();
      }
    }, this.matchingInterval);
  }

  private async executeMatching(): Promise<MatchingResult | null> {
    this.isMatching = true;
    
    try {
      const { buyOrders, sellOrders } = this.getOrderBook();
      const matchedOrders: TradeOrder[] = [];
      let totalVolume = 0;
      
      if (buyOrders.length === 0 || sellOrders.length === 0) {
        return null;
      }

      const clearingPrice = this.calculateClearingPrice(buyOrders, sellOrders);
      
      for (const buyOrder of buyOrders) {
        if (buyOrder.price >= clearingPrice) {
          const matchingSellOrder = sellOrders.find(
            sell => sell.price <= clearingPrice && sell.amount > 0
          );
          
          if (matchingSellOrder) {
            const tradeAmount = Math.min(buyOrder.amount, matchingSellOrder.amount);
            matchedOrders.push(buyOrder, matchingSellOrder);
            totalVolume += tradeAmount;
            
            this.orders.delete(buyOrder.id);
            this.orders.delete(matchingSellOrder.id);
          }
        }
      }

      return {
        clearingPrice,
        matchedOrders,
        totalVolume,
        timestamp: Date.now()
      };
    } finally {
      this.isMatching = false;
    }
  }

  private calculateClearingPrice(buyOrders: TradeOrder[], sellOrders: TradeOrder[]): number {
    if (buyOrders.length === 0 || sellOrders.length === 0) {
      return this.marketData?.price || 0;
    }

    const highestBuy = buyOrders[0].price;
    const lowestSell = sellOrders[0].price;
    
    return (highestBuy + lowestSell) / 2;
  }

  getMatchingStatus() {
    return {
      isMatching: this.isMatching,
      totalOrders: {
        buy: Array.from(this.orders.values()).filter(o => o.type === 'buy').length,
        sell: Array.from(this.orders.values()).filter(o => o.type === 'sell').length
      },
      nextRoundIn: this.matchingInterval / 1000,
      matchingInterval: this.matchingInterval
    };
  }

  getCurrentMarketData(): MarketData | null {
    return this.marketData;
  }
}

export { TradingCore, type TradeOrder, type MarketData, type MatchingResult };