/**
 * Mock Services
 * Temporary mock implementations for API development
 */

import { 
  DatabaseService, 
  OrderService, 
  MatchingEngineService,
  ExecutorCoordinatorService,
  MetricsService,
  Order,
  CreateOrderRequest,
  OrderStatistics,
  User,
  SystemMetrics
} from '../types/api.types';

export class MockDatabaseService implements DatabaseService {
  async healthCheck() {
    return {
      healthy: true,
      details: {
        connected: true,
        latency: 5,
        queries_per_second: 100,
      },
    };
  }

  async getMetrics() {
    return {
      connections: 10,
      queries_total: 1000,
      avg_query_time: 50,
    };
  }

  async getUserStatistics() {
    return {
      total: 150,
      active24h: 45,
    };
  }

  async getUsersAdmin({ page, limit, search }: { page: number; limit: number; search?: string }) {
    const mockUsers: User[] = [
      {
        id: '1',
        walletAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
        tradingTier: 'premium',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '2',
        walletAddress: '8yKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsV',
        tradingTier: 'basic',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    return {
      users: mockUsers.slice((page - 1) * limit, page * limit),
      totalCount: mockUsers.length,
    };
  }

  async updateUserStatus(userId: string, update: any): Promise<User> {
    return {
      id: userId,
      walletAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      tradingTier: 'premium',
      status: update.status,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}

export class MockOrderService implements OrderService {
  private orders: Order[] = [];

  async createOrder(userId: string, orderData: CreateOrderRequest): Promise<Order> {
    const order: Order = {
      id: `order_${Date.now()}`,
      userId,
      type: orderData.type,
      token: orderData.token,
      amount: orderData.amount,
      limitPrice: orderData.limitPrice,
      status: 'pending',
      encryptedData: orderData.encryptedData,
      zkProof: orderData.zkProof,
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: orderData.expiresAt ? new Date(orderData.expiresAt) : undefined,
    };

    this.orders.push(order);
    return order;
  }

  async getOrders(userId: string, filters?: any): Promise<Order[]> {
    return this.orders.filter(order => order.userId === userId);
  }

  async getOrder(orderId: string, userId: string): Promise<Order> {
    const order = this.orders.find(o => o.id === orderId && o.userId === userId);
    if (!order) {
      throw new Error('Order not found');
    }
    return order;
  }

  async cancelOrder(orderId: string, userId: string): Promise<Order> {
    const order = this.orders.find(o => o.id === orderId && o.userId === userId);
    if (!order) {
      throw new Error('Order not found');
    }
    order.status = 'cancelled';
    order.updatedAt = new Date();
    return order;
  }

  async getStatistics(userId?: string): Promise<OrderStatistics> {
    const userOrders = userId ? this.orders.filter(o => o.userId === userId) : this.orders;
    
    return {
      totalOrders: userOrders.length,
      activeOrders: userOrders.filter(o => ['pending', 'partial'].includes(o.status)).length,
      completedOrders: userOrders.filter(o => o.status === 'filled').length,
      totalVolume: userOrders.reduce((sum, order) => sum + parseFloat(order.amount), 0).toString(),
      averageOrderSize: userOrders.length > 0 
        ? (userOrders.reduce((sum, order) => sum + parseFloat(order.amount), 0) / userOrders.length).toString()
        : '0',
    };
  }

  async getOrdersAdmin({ page, limit, filters }: { page: number; limit: number; filters: any }) {
    let filteredOrders = this.orders;
    
    if (filters.status) {
      filteredOrders = filteredOrders.filter(o => o.status === filters.status);
    }
    if (filters.userId) {
      filteredOrders = filteredOrders.filter(o => o.userId === filters.userId);
    }

    return {
      orders: filteredOrders.slice((page - 1) * limit, page * limit),
      totalCount: filteredOrders.length,
    };
  }

  async adminCancelOrder(orderId: string, params: { adminId: string; reason: string }): Promise<Order> {
    const order = this.orders.find(o => o.id === orderId);
    if (!order) {
      throw new Error('Order not found');
    }
    order.status = 'cancelled';
    order.updatedAt = new Date();
    return order;
  }
}

export class MockMatchingEngineService implements MatchingEngineService {
  getSystemHealth() {
    return {
      status: 'healthy',
      details: {
        active_orders: 25,
        matches_per_second: 5,
        avg_matching_time: 100,
      },
    };
  }

  getMetrics() {
    return {
      total_matches: 500,
      successful_matches: 495,
      failed_matches: 5,
      avg_execution_time: 150,
    };
  }

  async submitTrade(tradeRequest: any) {
    return {
      id: `trade_${Date.now()}`,
      buyOrderId: tradeRequest.orderId,
      sellOrderId: tradeRequest.counterOrderId,
      amount: tradeRequest.amount,
      price: tradeRequest.price,
      timestamp: new Date(),
      status: 'pending' as const,
      zkProof: tradeRequest.zkMatchProof,
    };
  }

  async getOrderBook(token: string) {
    return {
      token,
      bids: [],
      asks: [],
      spread: '0.01',
      lastUpdate: new Date(),
    };
  }
}

export class MockExecutorCoordinatorService implements ExecutorCoordinatorService {
  async getNetworkHealth() {
    return {
      healthy: true,
      totalNodes: 5,
      healthyNodes: 5,
    };
  }

  async getExecutorHealth() {
    return {
      totalNodes: 5,
      healthyNodes: 5,
    };
  }

  async requestThresholdDecryption(request: any) {
    return {
      decryptedData: 'mock_decrypted_data',
      shares_collected: 3,
      threshold_met: true,
    };
  }
}

export class MockMetricsService implements MetricsService {
  async getMetrics(timeframe: string): Promise<SystemMetrics> {
    return {
      performance: {
        avgResponseTime: 120,
        requestsPerSecond: 50,
        errorRate: 0.02,
      },
      trading: {
        ordersPerMinute: 10,
        successfulMatches: 8,
        failedMatches: 2,
        averageExecutionTime: 200,
      },
      system: {
        cpuUsage: 45,
        memoryUsage: process.memoryUsage(),
        activeConnections: 25,
      },
    };
  }

  recordMetric(name: string, value: number, tags?: Record<string, string>) {
    // Mock implementation - would normally send to metrics backend
    console.log(`Metric recorded: ${name} = ${value}`, tags);
  }
}

// Create singleton instances
export const mockDatabaseService = new MockDatabaseService();
export const mockOrderService = new MockOrderService();
export const mockMatchingEngineService = new MockMatchingEngineService();
export const mockExecutorCoordinatorService = new MockExecutorCoordinatorService();
export const mockMetricsService = new MockMetricsService();

// Export services object for easy injection
export const mockServices = {
  db: mockDatabaseService,
  orderService: mockOrderService,
  matchingEngine: mockMatchingEngineService,
  executorCoordinator: mockExecutorCoordinatorService,
  metricsService: mockMetricsService,
};