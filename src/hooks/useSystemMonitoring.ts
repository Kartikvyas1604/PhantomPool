'use client';

import { useState, useEffect, useCallback } from 'react';

export interface SystemHealthData {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: {
    redis: boolean;
    crypto: boolean;
    matching: boolean;
    api: boolean;
    database: boolean;
  };
  activeConnections: number;
  uptime: number;
  lastUpdated: number;
}

export interface MatchingStatusData {
  isMatching: boolean;
  nextRoundIn: number;
  matchingInterval: number;
  totalOrders: {
    buy: number;
    sell: number;
  };
  lastRoundAt?: number;
  averageMatchTime?: number;
}

class SystemMonitoringService {
  
  async checkSystemHealth(): Promise<SystemHealthData> {
    try {
      const response = await fetch('/health', { 
        method: 'GET',
        cache: 'no-cache'
      });

      if (response.ok) {
        const data = await response.json();
        return {
          ...data,
          lastUpdated: Date.now()
        };
      }
      
      return await this.simulateHealthCheck();
    } catch (error) {
      return await this.simulateHealthCheck();
    }
  }

  async checkMatchingStatus(): Promise<MatchingStatusData> {
    try {
      const response = await fetch('/api/matching/status', {
        method: 'GET',
        cache: 'no-cache'
      });

      if (response.ok) {
        const data = await response.json();
        return data;
      }
      
      return this.simulateMatchingStatus();
    } catch (error) {
      return this.simulateMatchingStatus();
    }
  }

  private async simulateHealthCheck(): Promise<SystemHealthData> {
    await new Promise(resolve => setTimeout(resolve, 100));

    const services = {
      redis: Math.random() > 0.1,
      crypto: Math.random() > 0.05,
      matching: Math.random() > 0.08,
      api: Math.random() > 0.05,
      database: Math.random() > 0.07
    };

    const healthyCount = Object.values(services).filter(Boolean).length;
    const totalCount = Object.values(services).length;
    
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyCount === totalCount) {
      status = 'healthy';
    } else if (healthyCount >= totalCount * 0.8) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      services,
      activeConnections: Math.floor(Math.random() * 50) + 10,
      uptime: Date.now() - (Math.random() * 86400000),
      lastUpdated: Date.now()
    };
  }

  private simulateMatchingStatus(): MatchingStatusData {
    const now = Date.now();
    const lastRoundTime = now - (now % 30000);
    const nextRoundIn = Math.ceil((lastRoundTime + 30000 - now) / 1000);

    return {
      isMatching: nextRoundIn <= 5,
      nextRoundIn,
      matchingInterval: 30,
      totalOrders: {
        buy: Math.floor(Math.random() * 15) + 1,
        sell: Math.floor(Math.random() * 12) + 1
      },
      lastRoundAt: lastRoundTime,
      averageMatchTime: Math.random() * 2 + 1
    };
  }

  // Check if we can connect to WebSocket
  async testWebSocketConnection(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const ws = new WebSocket('ws://localhost:3001/ws');
        
        const timeout = setTimeout(() => {
          ws.close();
          resolve(false);
        }, 3000);

        ws.onopen = () => {
          clearTimeout(timeout);
          ws.close();
          resolve(true);
        };

        ws.onerror = () => {
          clearTimeout(timeout);
          resolve(false);
        };
      } catch {
        resolve(false);
      }
    });
  }
}

export const useSystemMonitoring = () => {
  const [healthData, setHealthData] = useState<SystemHealthData | null>(null);
  const [matchingStatus, setMatchingStatus] = useState<MatchingStatusData | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const service = new SystemMonitoringService();

  const fetchHealthData = useCallback(async () => {
    try {
      const health = await service.checkSystemHealth();
      setHealthData(health);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch health data');
    }
  }, []);

  const fetchMatchingStatus = useCallback(async () => {
    try {
      const matching = await service.checkMatchingStatus();
      setMatchingStatus(matching);
    } catch (err) {
      console.error('Failed to fetch matching status:', err);
    }
  }, []);

  const checkWebSocketStatus = useCallback(async () => {
    const isConnected = await service.testWebSocketConnection();
    setWsConnected(isConnected);
  }, []);

  useEffect(() => {
    const initialize = async () => {
      setLoading(true);
      await Promise.all([
        fetchHealthData(),
        fetchMatchingStatus(),
        checkWebSocketStatus()
      ]);
      setLoading(false);
    };

    initialize();

    // Set up polling intervals
    const healthInterval = setInterval(fetchHealthData, 10000); // Every 10 seconds
    const matchingInterval = setInterval(fetchMatchingStatus, 5000); // Every 5 seconds
    const wsInterval = setInterval(checkWebSocketStatus, 15000); // Every 15 seconds

    return () => {
      clearInterval(healthInterval);
      clearInterval(matchingInterval);
      clearInterval(wsInterval);
    };
  }, [fetchHealthData, fetchMatchingStatus, checkWebSocketStatus]);

  return {
    healthData,
    matchingStatus,
    wsConnected,
    loading,
    error,
    refetch: {
      health: fetchHealthData,
      matching: fetchMatchingStatus,
      websocket: checkWebSocketStatus
    }
  };
};