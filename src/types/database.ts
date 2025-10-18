/**
 * PhantomPool Database Types
 * Generated TypeScript interfaces for Supabase tables
 */

// =====================================================
// USER TYPES
// =====================================================

export interface User {
  id: string;
  auth_user_id: string;
  wallet_address: string;
  username?: string;
  email?: string;
  kyc_status: 'pending' | 'verified' | 'rejected';
  risk_score: number;
  trading_tier: 'basic' | 'premium' | 'institutional';
  max_order_size: number;
  daily_volume_limit: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_login?: string;
  metadata: Record<string, any>;
}

export interface UserBalance {
  id: string;
  user_id: string;
  token_mint: string;
  balance: number;
  available_balance: number;
  locked_balance: number;
  balance_commitment?: string;
  last_solvency_proof?: string;
  created_at: string;
  updated_at: string;
}

// =====================================================
// TRADING TYPES
// =====================================================

export interface TradingPair {
  id: string;
  base_token: string;
  quote_token: string;
  base_token_name: string;
  quote_token_name: string;
  base_decimals: number;
  quote_decimals: number;
  min_order_size: number;
  max_order_size: number;
  tick_size: number;
  is_active: boolean;
  created_at: string;
}

export interface MarketStats {
  id: string;
  trading_pair_id: string;
  last_price?: number;
  volume_24h: number;
  high_24h?: number;
  low_24h?: number;
  price_change_24h?: number;
  total_orders: number;
  active_buy_orders: number;
  active_sell_orders: number;
  liquidity_depth: number;
  updated_at: string;
}

// =====================================================
// ORDER TYPES
// =====================================================

export interface ElGamalCiphertext {
  c1: {
    x: string;
    y: string;
  };
  c2: {
    x: string;
    y: string;
  };
}

export interface SolvencyProof {
  commitment: any;
  proof: Uint8Array;
  publicInputs: any[];
  auditToken: string;
  balanceCommitment: any;
  requiredAmount: string; // BN serialized
  timestamp: number;
}

export interface EncryptedOrder {
  id: string;
  user_id: string;
  trading_pair_id: string;
  order_type: 'market' | 'limit';
  side: 'buy' | 'sell';
  encrypted_amount: string; // Serialized ElGamalCiphertext
  encrypted_price: string;  // Serialized ElGamalCiphertext
  solvency_proof: SolvencyProof;
  range_proof?: any;
  signature_proof: string;
  nonce: string;
  expiry_time?: string;
  min_fill_amount?: number;
  status: 'pending' | 'active' | 'partially_filled' | 'filled' | 'cancelled' | 'expired';
  filled_amount: number;
  remaining_amount: number;
  created_at: string;
  updated_at: string;
  activated_at?: string;
  expires_at?: string;
}

export interface OrderPool {
  id: string;
  trading_pair_id: string;
  side: 'buy' | 'sell';
  aggregated_amount_commitment?: string;
  aggregated_price_commitment?: string;
  order_count: number;
  vrf_seed: string;
  vrf_proof?: any;
  batch_solvency_proof?: any;
  batch_range_proof?: any;
  created_at: string;
  updated_at: string;
}

// =====================================================
// MATCHING & EXECUTION TYPES
// =====================================================

export interface MatchingSession {
  id: string;
  trading_pair_id: string;
  session_number: number;
  buy_orders_count: number;
  sell_orders_count: number;
  clearing_price?: number;
  total_volume: number;
  matching_proof?: any;
  vrf_proof?: any;
  price_discovery_proof?: any;
  execution_transaction?: string;
  execution_status: 'pending' | 'executing' | 'completed' | 'failed';
  executor_assignments?: any;
  threshold_shares?: any;
  created_at: string;
  matched_at?: string;
  executed_at?: string;
}

export interface Trade {
  id: string;
  matching_session_id: string;
  buy_order_id: string;
  sell_order_id: string;
  buyer_id: string;
  seller_id: string;
  amount: number;
  price: number;
  total_value: number;
  buyer_fee: number;
  seller_fee: number;
  protocol_fee: number;
  settlement_signature?: string;
  settlement_status: 'pending' | 'confirmed' | 'failed';
  created_at: string;
  settled_at?: string;
}

// =====================================================
// THRESHOLD NETWORK TYPES
// =====================================================

export interface ExecutorNode {
  id: string;
  node_id: number;
  public_key: string;
  endpoint_url: string;
  status: 'online' | 'offline' | 'degraded' | 'maintenance';
  last_heartbeat: string;
  total_requests: number;
  successful_requests: number;
  avg_response_time: number;
  error_count: number;
  health_score: number;
  created_at: string;
  updated_at: string;
}

export interface ThresholdOperation {
  id: string;
  matching_session_id: string;
  operation_type: 'partial_decrypt' | 'combine_shares' | 'verify_proof';
  required_shares: number;
  total_shares: number;
  encrypted_data: string;
  shares_received: number;
  partial_results: Record<string, any>;
  combined_result?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  created_at: string;
  completed_at?: string;
}

export interface ExecutorResponse {
  id: string;
  threshold_operation_id: string;
  executor_node_id: string;
  partial_result?: string;
  proof_data?: any;
  signature: string;
  is_valid: boolean;
  validation_error?: string;
  created_at: string;
}

// =====================================================
// CRYPTOGRAPHIC PROOF TYPES
// =====================================================

export interface CryptographicProof {
  id: string;
  proof_type: 'solvency' | 'range' | 'matching' | 'vrf' | 'execution' | 'shuffle';
  order_id?: string;
  matching_session_id?: string;
  user_id?: string;
  proof_data: any;
  public_inputs?: any;
  verification_key?: any;
  is_verified: boolean;
  verification_time?: string;
  verifier_node?: string;
  proof_size?: number;
  generation_time?: number;
  created_at: string;
}

export interface AuditLog {
  id: string;
  event_type: string;
  event_category: 'order' | 'matching' | 'execution' | 'admin' | 'security';
  user_id?: string;
  order_id?: string;
  matching_session_id?: string;
  event_data: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  security_flags: Record<string, any>;
  created_at: string;
}

// =====================================================
// MONITORING TYPES
// =====================================================

export interface SystemMetric {
  id: string;
  metric_name: string;
  metric_value: number;
  metric_unit?: string;
  component?: string;
  trading_pair_id?: string;
  period_start: string;
  period_end: string;
  created_at: string;
}

export interface SystemHealth {
  id: string;
  component: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'offline';
  health_score: number;
  response_time?: number;
  throughput?: number;
  error_rate?: number;
  details: Record<string, any>;
  last_check: string;
  updated_at: string;
}

// =====================================================
// VIEW TYPES
// =====================================================

export interface MarketOverview {
  id: string;
  base_token: string;
  quote_token: string;
  base_token_name: string;
  quote_token_name: string;
  last_price?: number;
  volume_24h?: number;
  price_change_24h?: number;
  total_orders?: number;
  active_buy_orders?: number;
  active_sell_orders?: number;
  updated_at?: string;
}

export interface UserTradingStats {
  id: string;
  wallet_address: string;
  total_orders?: number;
  filled_orders?: number;
  total_trades?: number;
  total_volume?: number;
  last_order_time?: string;
  last_trade_time?: string;
}

export interface SystemHealthOverview {
  component: string;
  status: string;
  health_score: number;
  response_time?: number;
  throughput?: number;
  error_rate?: number;
  last_check: string;
  data_freshness: 'current' | 'stale';
}

// =====================================================
// API REQUEST/RESPONSE TYPES
// =====================================================

export interface SubmitOrderRequest {
  trading_pair_id: string;
  order_type: 'market' | 'limit';
  side: 'buy' | 'sell';
  encrypted_amount: string;
  encrypted_price: string;
  solvency_proof: SolvencyProof;
  signature_proof: string;
  nonce: string;
  expiry_time?: string;
}

export interface SubmitOrderResponse {
  success: boolean;
  order_id: string;
  pool_position: number;
  estimated_match_time: number;
  error?: string;
}

export interface OrderBookState {
  trading_pair_id: string;
  buy_orders: number;
  sell_orders: number;
  aggregated_commitments: {
    buy?: any;
    sell?: any;
  };
  vrf_seeds: {
    buy?: string;
    sell?: string;
  };
}

export interface MatchingResult {
  match_id: string;
  buy_orders: EncryptedOrder[];
  sell_orders: EncryptedOrder[];
  clearing_price: string;
  total_volume: string;
  price_discovery_proof: any;
  matching_proof: any;
  vrf_proof: any;
  timestamp: number;
}

export interface ThresholdDecryptionRequest {
  matching_session_id: string;
  operation_type: 'partial_decrypt' | 'combine_shares';
  encrypted_data: string;
  required_shares?: number;
}

export interface ThresholdDecryptionResponse {
  operation_id: string;
  status: 'initiated' | 'in_progress' | 'completed' | 'failed';
  shares_received: number;
  required_shares: number;
  result?: string;
}

// =====================================================
// DATABASE FUNCTIONS TYPES
// =====================================================

export interface SubmitEncryptedOrderParams {
  p_user_id: string;
  p_trading_pair_id: string;
  p_order_type: string;
  p_side: string;
  p_encrypted_amount: string;
  p_encrypted_price: string;
  p_solvency_proof: any;
  p_signature_proof: string;
  p_nonce: string;
  p_expiry_time?: string;
}

export interface CreateMatchingSessionParams {
  p_trading_pair_id: string;
  p_buy_orders: string[];
  p_sell_orders: string[];
  p_clearing_price: number;
  p_total_volume: number;
  p_matching_proof: any;
  p_vrf_proof: any;
  p_price_discovery_proof: any;
}

export interface UpdateSystemHealthParams {
  p_component: string;
  p_status: string;
  p_health_score: number;
  p_response_time?: number;
  p_throughput?: number;
  p_error_rate?: number;
  p_details?: any;
}

// =====================================================
// WEBSOCKET MESSAGE TYPES
// =====================================================

export interface WebSocketMessage {
  type: 'order_update' | 'matching_complete' | 'trade_executed' | 'system_health' | 'market_update';
  data: any;
  timestamp: number;
}

export interface OrderUpdateMessage extends WebSocketMessage {
  type: 'order_update';
  data: {
    order_id: string;
    status: string;
    filled_amount?: number;
    remaining_amount?: number;
  };
}

export interface MatchingCompleteMessage extends WebSocketMessage {
  type: 'matching_complete';
  data: {
    matching_session_id: string;
    trading_pair_id: string;
    clearing_price: number;
    total_volume: number;
    matched_orders: number;
  };
}

export interface TradeExecutedMessage extends WebSocketMessage {
  type: 'trade_executed';
  data: {
    trade_id: string;
    amount: number;
    price: number;
    trading_pair_id: string;
  };
}

export interface MarketUpdateMessage extends WebSocketMessage {
  type: 'market_update';
  data: MarketStats;
}

// =====================================================
// UTILITY TYPES
// =====================================================

export type Database = {
  public: {
    Tables: {
      users: {
        Row: User;
        Insert: Omit<User, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<User, 'id' | 'created_at'>>;
      };
      user_balances: {
        Row: UserBalance;
        Insert: Omit<UserBalance, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<UserBalance, 'id' | 'created_at'>>;
      };
      trading_pairs: {
        Row: TradingPair;
        Insert: Omit<TradingPair, 'id' | 'created_at'>;
        Update: Partial<Omit<TradingPair, 'id' | 'created_at'>>;
      };
      market_stats: {
        Row: MarketStats;
        Insert: Omit<MarketStats, 'id' | 'updated_at'>;
        Update: Partial<Omit<MarketStats, 'id'>>;
      };
      encrypted_orders: {
        Row: EncryptedOrder;
        Insert: Omit<EncryptedOrder, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<EncryptedOrder, 'id' | 'created_at'>>;
      };
      order_pools: {
        Row: OrderPool;
        Insert: Omit<OrderPool, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<OrderPool, 'id' | 'created_at'>>;
      };
      matching_sessions: {
        Row: MatchingSession;
        Insert: Omit<MatchingSession, 'id' | 'created_at'>;
        Update: Partial<Omit<MatchingSession, 'id' | 'created_at'>>;
      };
      trades: {
        Row: Trade;
        Insert: Omit<Trade, 'id' | 'created_at'>;
        Update: Partial<Omit<Trade, 'id' | 'created_at'>>;
      };
      executor_nodes: {
        Row: ExecutorNode;
        Insert: Omit<ExecutorNode, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<ExecutorNode, 'id' | 'created_at'>>;
      };
      threshold_operations: {
        Row: ThresholdOperation;
        Insert: Omit<ThresholdOperation, 'id' | 'created_at'>;
        Update: Partial<Omit<ThresholdOperation, 'id' | 'created_at'>>;
      };
      executor_responses: {
        Row: ExecutorResponse;
        Insert: Omit<ExecutorResponse, 'id' | 'created_at'>;
        Update: Partial<Omit<ExecutorResponse, 'id' | 'created_at'>>;
      };
      cryptographic_proofs: {
        Row: CryptographicProof;
        Insert: Omit<CryptographicProof, 'id' | 'created_at'>;
        Update: Partial<Omit<CryptographicProof, 'id' | 'created_at'>>;
      };
      audit_log: {
        Row: AuditLog;
        Insert: Omit<AuditLog, 'id' | 'created_at'>;
        Update: Partial<Omit<AuditLog, 'id' | 'created_at'>>;
      };
      system_metrics: {
        Row: SystemMetric;
        Insert: Omit<SystemMetric, 'id' | 'created_at'>;
        Update: Partial<Omit<SystemMetric, 'id' | 'created_at'>>;
      };
      system_health: {
        Row: SystemHealth;
        Insert: Omit<SystemHealth, 'id' | 'last_check' | 'updated_at'>;
        Update: Partial<Omit<SystemHealth, 'id'>>;
      };
    };
    Views: {
      market_overview: {
        Row: MarketOverview;
      };
      user_trading_stats: {
        Row: UserTradingStats;
      };
      system_health_overview: {
        Row: SystemHealthOverview;
      };
    };
    Functions: {
      submit_encrypted_order: {
        Args: SubmitEncryptedOrderParams;
        Returns: string;
      };
      create_matching_session: {
        Args: CreateMatchingSessionParams;
        Returns: string;
      };
      update_system_health: {
        Args: UpdateSystemHealthParams;
        Returns: void;
      };
      get_user_orders: {
        Args: { p_user_id: string; p_limit?: number; p_offset?: number };
        Returns: Array<{
          id: string;
          trading_pair_id: string;
          order_type: string;
          side: string;
          status: string;
          created_at: string;
          expires_at?: string;
          base_token: string;
          quote_token: string;
        }>;
      };
      cleanup_expired_orders: {
        Args: {};
        Returns: number;
      };
    };
  };
};

// Export the full database type
export type { Database as SupabaseDatabase };