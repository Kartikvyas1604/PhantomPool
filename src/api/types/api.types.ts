/**
 * API Types & Interfaces
 * Type definitions for the PhantomPool REST API
 */

import { Request } from 'express';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        walletAddress: string;
        tradingTier: 'basic' | 'premium' | 'institutional';
        isAdmin?: boolean;
      };
    }
  }
}

// User Types
export interface User {
  id: string;
  walletAddress: string;
  tradingTier: 'basic' | 'premium' | 'institutional';
  status: 'active' | 'suspended' | 'banned';
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

// Order Types
export interface Order {
  id: string;
  userId: string;
  type: 'buy' | 'sell';
  token: string;
  amount: string;
  limitPrice?: string;
  status: 'pending' | 'partial' | 'filled' | 'cancelled' | 'expired';
  encryptedData: string;
  zkProof?: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  fills?: OrderFill[];
}

export interface OrderFill {
  id: string;
  orderId: string;
  amount: string;
  price: string;
  timestamp: Date;
  transactionHash?: string;
}

export interface CreateOrderRequest {
  type: 'buy' | 'sell';
  token: string;
  amount: string;
  limitPrice?: string;
  expiresAt?: string;
  encryptedData: string;
  zkProof?: string;
}

export interface OrderStatistics {
  totalOrders: number;
  activeOrders: number;
  completedOrders: number;
  totalVolume: string;
  averageOrderSize: string;
}

// Trading Types
export interface TradeRequest {
  orderId: string;
  counterOrderId: string;
  amount: string;
  price: string;
  zkMatchProof: string;
}

export interface Trade {
  id: string;
  buyOrderId: string;
  sellOrderId: string;
  amount: string;
  price: string;
  timestamp: Date;
  status: 'pending' | 'confirmed' | 'failed';
  transactionHash?: string;
  zkProof: string;
}

// Cryptographic Types
export interface ZKProof {
  type: 'bulletproof' | 'range' | 'matching' | 'threshold';
  proof: string;
  publicInputs: string[];
  verificationKey?: string;
}

export interface EncryptedData {
  ciphertext: string;
  nonce: string;
  publicKey: string;
}

export interface ThresholdDecryptionRequest {
  encryptedData: EncryptedData;
  proofOfDecryption: string;
  requiredShares: number;
}

// Network Types
export interface ExecutorNode {
  id: string;
  address: string;
  publicKey: string;
  status: 'active' | 'inactive' | 'unhealthy';
  lastSeen: Date;
  stake: string;
  reputation: number;
}

export interface NetworkHealth {
  totalNodes: number;
  healthyNodes: number;
  unhealthyNodes: number;
  averageLatency: number;
  networkStatus: 'healthy' | 'degraded' | 'critical';
}

// API Response Types
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> extends APIResponse<{
  items: T[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
}> {}

export interface HealthCheck {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  checks?: Record<string, any>;
}

// Validation Types
export interface ValidationRule {
  field: string;
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'array' | 'object';
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: any) => boolean | string;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

// WebSocket Types
export interface WebSocketMessage {
  type: 'order_update' | 'trade_execution' | 'system_status' | 'error';
  data: any;
  timestamp: string;
  userId?: string;
}

export interface OrderUpdateMessage extends WebSocketMessage {
  type: 'order_update';
  data: {
    orderId: string;
    status: Order['status'];
    fills?: OrderFill[];
  };
}

export interface TradeExecutionMessage extends WebSocketMessage {
  type: 'trade_execution';
  data: Trade;
}

// Admin Types
export interface AdminDashboard {
  system: {
    uptime: number;
    version: string;
    environment: string;
    memory: NodeJS.MemoryUsage;
  };
  statistics: {
    totalOrders: number;
    activeOrders: number;
    completedTrades: number;
    totalVolume: string;
    users: {
      total: number;
      active24h: number;
    };
  };
  network: {
    executorNodes: number;
    healthyNodes: number;
    networkStatus: string;
  };
}

export interface SystemMetrics {
  performance: {
    avgResponseTime: number;
    requestsPerSecond: number;
    errorRate: number;
  };
  trading: {
    ordersPerMinute: number;
    successfulMatches: number;
    failedMatches: number;
    averageExecutionTime: number;
  };
  system: {
    cpuUsage: number;
    memoryUsage: NodeJS.MemoryUsage;
    activeConnections: number;
  };
}

// Service Interfaces
export interface DatabaseService {
  healthCheck(): Promise<{ healthy: boolean; details: any }>;
  getMetrics(): Promise<any>;
  getUserStatistics(): Promise<{ total: number; active24h: number }>;
  getUsersAdmin(params: { page: number; limit: number; search?: string }): Promise<{
    users: User[];
    totalCount: number;
  }>;
  updateUserStatus(userId: string, update: {
    status: User['status'];
    reason?: string;
    adminId: string;
    timestamp: Date;
  }): Promise<User>;
}

export interface OrderService {
  createOrder(userId: string, orderData: CreateOrderRequest): Promise<Order>;
  getOrders(userId: string, filters?: any): Promise<Order[]>;
  getOrder(orderId: string, userId: string): Promise<Order>;
  cancelOrder(orderId: string, userId: string): Promise<Order>;
  getStatistics(userId?: string): Promise<OrderStatistics>;
  getOrdersAdmin(params: {
    page: number;
    limit: number;
    filters: any;
  }): Promise<{ orders: Order[]; totalCount: number }>;
  adminCancelOrder(orderId: string, params: {
    adminId: string;
    reason: string;
  }): Promise<Order>;
}

export interface MatchingEngineService {
  getSystemHealth(): { status: string; details: any };
  getMetrics(): any;
  submitTrade(tradeRequest: TradeRequest): Promise<Trade>;
  getOrderBook(token: string): Promise<any>;
}

export interface ExecutorCoordinatorService {
  getNetworkHealth(): Promise<{ healthy: boolean; totalNodes: number; healthyNodes: number }>;
  getExecutorHealth(): Promise<{ totalNodes: number; healthyNodes: number }>;
  requestThresholdDecryption(request: ThresholdDecryptionRequest): Promise<any>;
}

export interface MetricsService {
  getMetrics(timeframe: string): Promise<SystemMetrics>;
  recordMetric(name: string, value: number, tags?: Record<string, string>): void;
}

// Error Types
export class PhantomPoolError extends Error {
  public statusCode: number;
  public code: string;
  public details?: any;

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR', details?: any) {
    super(message);
    this.name = 'PhantomPoolError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends PhantomPoolError {
  constructor(message: string, details?: ValidationError[]) {
    super(message, 400, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends PhantomPoolError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends PhantomPoolError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends PhantomPoolError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND_ERROR');
    this.name = 'NotFoundError';
  }
}

export class RateLimitError extends PhantomPoolError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_ERROR');
    this.name = 'RateLimitError';
  }
}