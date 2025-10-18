'use client';

interface Order {
  id?: string;
  type: 'buy' | 'sell';
  token: string;
  amount: string;
  price: string;
  status?: string;
  trader?: string;
  encryptedData?: string;
  timestamp?: number;
}

interface Trade {
  id: string;
  orderId: string;
  counterOrderId: string;
  amount: string;
  price: string;
  timestamp: number;
  zkMatchProof?: string;
}

interface OrderBookEntry {
  price: string;
  amount: string;
  orders: number;
}

interface OrderBook {
  token: string;
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  lastUpdate: number;
}

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

class PhantomPoolAPIService {
  private baseUrl: string;
  private userId: string;

  constructor(baseUrl: string = 'http://localhost:8080/api', userId: string = 'default_user') {
    this.baseUrl = baseUrl;
    this.userId = userId;
  }

  private async makeRequest<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      
      const defaultHeaders = {
        'Content-Type': 'application/json',
        'User-Id': this.userId,
      };

      const response = await fetch(url, {
        ...options,
        headers: {
          ...defaultHeaders,
          ...options.headers,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `HTTP ${response.status}`,
          message: data.message
        };
      }

      return {
        success: true,
        data: data.data || data,
        message: data.message
      };

    } catch (error) {
      console.error('API request failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Health and Status
  async getHealth() {
    return this.makeRequest('/health');
  }

  async getWebSocketStatus() {
    return this.makeRequest('/websocket/status');
  }

  // Order Management
  async createOrder(order: Order): Promise<ApiResponse<Order>> {
    const orderData = {
      type: order.type,
      token: order.token || 'SOL',
      amount: order.amount,
      price: order.price,
      encryptedData: order.encryptedData || `encrypted_${Date.now()}_${Math.random().toString(36).substring(7)}`
    };

    return this.makeRequest<Order>('/orders', {
      method: 'POST',
      body: JSON.stringify(orderData)
    });
  }

  async getOrders(filters?: { status?: string; type?: string; limit?: number }) {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.type) params.append('type', filters.type);
    if (filters?.limit) params.append('limit', filters.limit.toString());
    
    const queryString = params.toString();
    const endpoint = queryString ? `/orders?${queryString}` : '/orders';
    
    return this.makeRequest(endpoint);
  }

  async getOrder(orderId: string) {
    return this.makeRequest(`/orders/${orderId}`);
  }

  async updateOrderStatus(orderId: string, status: string) {
    return this.makeRequest(`/orders/${orderId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  }

  async cancelOrder(orderId: string) {
    return this.makeRequest(`/orders/${orderId}`, {
      method: 'DELETE'
    });
  }

  async getOrderStats() {
    return this.makeRequest('/orders/stats');
  }

  // Trading
  async matchOrders(tradeData: {
    orderId: string;
    counterOrderId: string;
    amount: string;
    price: string;
    zkMatchProof?: string;
  }): Promise<ApiResponse<Trade>> {
    return this.makeRequest<Trade>('/trading/match', {
      method: 'POST',
      body: JSON.stringify({
        ...tradeData,
        zkMatchProof: tradeData.zkMatchProof || `proof_${Date.now()}_${Math.random().toString(36).substring(7)}`
      })
    });
  }

  async getTrades(filters?: { orderId?: string; limit?: number }) {
    const params = new URLSearchParams();
    if (filters?.orderId) params.append('orderId', filters.orderId);
    if (filters?.limit) params.append('limit', filters.limit.toString());
    
    const queryString = params.toString();
    const endpoint = queryString ? `/trading/trades?${queryString}` : '/trading/trades';
    
    return this.makeRequest(endpoint);
  }

  async executeOrder(orderId: string, executionData: {
    amount: string;
    price: string;
    counterparty?: string;
  }) {
    return this.makeRequest(`/trading/execute/${orderId}`, {
      method: 'POST',
      body: JSON.stringify(executionData)
    });
  }

  async simulateOrderBookUpdate(token: string = 'SOL') {
    return this.makeRequest(`/trading/simulate-orderbook-update/${token}`, {
      method: 'POST'
    });
  }

  // OrderBook
  async getOrderBook(token: string = 'SOL'): Promise<ApiResponse<OrderBook>> {
    return this.makeRequest<OrderBook>(`/orderbook/${token}`);
  }

  // Onchain Operations
  async getOnchainOrders(filters?: { status?: string; limit?: number }) {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.limit) params.append('limit', filters.limit.toString());
    
    const queryString = params.toString();
    const endpoint = queryString ? `/onchain/orders?${queryString}` : '/onchain/orders';
    
    return this.makeRequest(endpoint);
  }

  async settleOrder(orderId: string, settlementData: {
    txHash: string;
    blockHeight?: number;
    finalAmount?: string;
  }) {
    return this.makeRequest(`/onchain/settle/${orderId}`, {
      method: 'POST',
      body: JSON.stringify(settlementData)
    });
  }

  // Crypto Services
  async generateBulletproof(data: {
    value: string;
    blinding: string;
  }) {
    return this.makeRequest('/crypto/bulletproof/generate', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async verifyBulletproof(proof: string) {
    return this.makeRequest('/crypto/bulletproof/verify', {
      method: 'POST',
      body: JSON.stringify({ proof })
    });
  }

  async encryptOrder(data: {
    amount: string;
    price: string;
    publicKey?: string;
  }) {
    return this.makeRequest('/crypto/elgamal/encrypt', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async generateVRF(input: string) {
    return this.makeRequest('/crypto/vrf/generate', {
      method: 'POST',
      body: JSON.stringify({ input })
    });
  }

  // Threshold Network
  async getThresholdStatus() {
    return this.makeRequest('/threshold/status');
  }

  async requestThresholdSignature(data: {
    orderId: string;
    messageHash: string;
  }) {
    return this.makeRequest('/threshold/sign', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // Admin & Monitoring
  async getDashboard() {
    return this.makeRequest('/admin/dashboard');
  }

  async getSystemMetrics() {
    return this.makeRequest('/admin/metrics');
  }

  async broadcastWebSocketMessage(data: {
    channel: string;
    message: object;
  }) {
    return this.makeRequest('/websocket/broadcast', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // User Management
  setUserId(userId: string) {
    this.userId = userId;
  }

  getUserId(): string {
    return this.userId;
  }

  // Utility Methods
  async testConnection(): Promise<boolean> {
    const response = await this.getHealth();
    return response.success;
  }

  async waitForConnection(timeout: number = 5000): Promise<boolean> {
    const start = Date.now();
    
    while (Date.now() - start < timeout) {
      if (await this.testConnection()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return false;
  }
}

// Singleton instance
let apiServiceInstance: PhantomPoolAPIService | null = null;

export function getAPIService(baseUrl?: string, userId?: string): PhantomPoolAPIService {
  if (!apiServiceInstance) {
    apiServiceInstance = new PhantomPoolAPIService(baseUrl, userId);
  }
  return apiServiceInstance;
}

export { PhantomPoolAPIService };
export type { Order, Trade, OrderBook, OrderBookEntry, ApiResponse };