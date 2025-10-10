class APIClient {
  private baseURL: string;

  constructor() {
    this.baseURL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API request failed: ${url}`, error);
      throw error;
    }
  }

  // Order endpoints
  async submitOrder(orderData: {
    walletAddress: string;
    tokenPair: string;
    side: 'BUY' | 'SELL';
    amount: number;
    limitPrice: number;
    balance: number;
    signature: string;
  }) {
    return this.request('/api/orders/submit', {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
  }

  async getOrder(orderHash: string) {
    return this.request(`/api/orders/${orderHash}`);
  }

  async getOrderBook(tokenPair: string) {
    return this.request(`/api/orders/book/${tokenPair}`);
  }

  async getWalletOrders(walletAddress: string, limit = 50) {
    return this.request(`/api/orders/wallet/${walletAddress}?limit=${limit}`);
  }

  async cancelOrder(orderHash: string) {
    return this.request(`/api/orders/${orderHash}`, {
      method: 'DELETE',
    });
  }

  // Matching engine endpoints
  async getMatchingStatus() {
    return this.request('/api/matching/status');
  }

  async getMatchingRound(roundNumber: number) {
    return this.request(`/api/matching/rounds/${roundNumber}`);
  }

  async getMatchingHistory(limit = 10) {
    return this.request(`/api/matching/history?limit=${limit}`);
  }

  // Analytics endpoints
  async getVolumeData(timeframe = '24h') {
    return this.request(`/api/analytics/volume?timeframe=${timeframe}`);
  }

  async getPriceHistory(tokenPair: string, timeframe = '1h') {
    return this.request(`/api/analytics/price-history?tokenPair=${tokenPair}&timeframe=${timeframe}`);
  }

  async getExecutorStats() {
    return this.request('/api/analytics/executors');
  }

  // Health endpoints
  async getHealth() {
    return this.request('/health');
  }

  async getSystemStatus() {
    return this.request('/api/system/status');
  }
}

export const apiClient = new APIClient();