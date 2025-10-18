/**
 * Supabase Client Configuration
 * Database connection and real-time subscriptions for PhantomPool
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SupabaseDatabase } from '../types/database';

// Environment variables (to be set in production)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';

// Create Supabase client with proper typing
export const supabase: SupabaseClient<SupabaseDatabase> = createClient<SupabaseDatabase>(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);

// =====================================================
// DATABASE SERVICE CLASS
// =====================================================

export class DatabaseService {
  private client: SupabaseClient<SupabaseDatabase>;

  constructor(client?: SupabaseClient<SupabaseDatabase>) {
    this.client = client || supabase;
  }

  // =====================================================
  // USER OPERATIONS
  // =====================================================

  async createUser(userData: {
    auth_user_id: string;
    wallet_address: string;
    username?: string;
    email?: string;
  }) {
    const { data, error } = await this.client
      .from('users')
      .insert(userData)
      .select()
      .single();

    if (error) throw new Error(`Failed to create user: ${error.message}`);
    return data;
  }

  async getUserByWallet(walletAddress: string) {
    const { data, error } = await this.client
      .from('users')
      .select('*')
      .eq('wallet_address', walletAddress)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get user: ${error.message}`);
    }
    return data;
  }

  async getUserBalances(userId: string) {
    const { data, error } = await this.client
      .from('user_balances')
      .select('*')
      .eq('user_id', userId);

    if (error) throw new Error(`Failed to get balances: ${error.message}`);
    return data || [];
  }

  async updateUserBalance(userId: string, tokenMint: string, balance: number) {
    const { data, error } = await this.client
      .from('user_balances')
      .upsert({
        user_id: userId,
        token_mint: tokenMint,
        balance,
        available_balance: balance,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to update balance: ${error.message}`);
    return data;
  }

  // =====================================================
  // ORDER OPERATIONS
  // =====================================================

  async submitEncryptedOrder(orderData: {
    user_id: string;
    trading_pair_id: string;
    order_type: 'market' | 'limit';
    side: 'buy' | 'sell';
    encrypted_amount: string;
    encrypted_price: string;
    solvency_proof: any;
    signature_proof: string;
    nonce: string;
    expiry_time?: string;
  }) {
    const { data, error } = await this.client.rpc('submit_encrypted_order', {
      p_user_id: orderData.user_id,
      p_trading_pair_id: orderData.trading_pair_id,
      p_order_type: orderData.order_type,
      p_side: orderData.side,
      p_encrypted_amount: orderData.encrypted_amount,
      p_encrypted_price: orderData.encrypted_price,
      p_solvency_proof: orderData.solvency_proof,
      p_signature_proof: orderData.signature_proof,
      p_nonce: orderData.nonce,
      p_expiry_time: orderData.expiry_time,
    });

    if (error) throw new Error(`Failed to submit order: ${error.message}`);
    return data;
  }

  async getUserOrders(userId: string, limit: number = 50, offset: number = 0) {
    const { data, error } = await this.client.rpc('get_user_orders', {
      p_user_id: userId,
      p_limit: limit,
      p_offset: offset,
    });

    if (error) throw new Error(`Failed to get user orders: ${error.message}`);
    return data || [];
  }

  async getOrderById(orderId: string) {
    const { data, error } = await this.client
      .from('encrypted_orders')
      .select(`
        *,
        trading_pairs (
          base_token,
          quote_token,
          base_token_name,
          quote_token_name
        )
      `)
      .eq('id', orderId)
      .single();

    if (error) throw new Error(`Failed to get order: ${error.message}`);
    return data;
  }

  async cancelOrder(orderId: string, userId: string) {
    const { data, error } = await this.client
      .from('encrypted_orders')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', orderId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw new Error(`Failed to cancel order: ${error.message}`);
    return data;
  }

  // =====================================================
  // TRADING PAIR OPERATIONS
  // =====================================================

  async getTradingPairs() {
    const { data, error } = await this.client
      .from('trading_pairs')
      .select('*')
      .eq('is_active', true)
      .order('created_at');

    if (error) throw new Error(`Failed to get trading pairs: ${error.message}`);
    return data || [];
  }

  async getMarketStats() {
    const { data, error } = await this.client
      .from('market_overview')
      .select('*')
      .order('volume_24h', { ascending: false });

    if (error) throw new Error(`Failed to get market stats: ${error.message}`);
    return data || [];
  }

  // =====================================================
  // MATCHING & EXECUTION
  // =====================================================

  async createMatchingSession(sessionData: {
    trading_pair_id: string;
    buy_orders: string[];
    sell_orders: string[];
    clearing_price: number;
    total_volume: number;
    matching_proof: any;
    vrf_proof: any;
    price_discovery_proof: any;
  }) {
    const { data, error } = await this.client.rpc('create_matching_session', {
      p_trading_pair_id: sessionData.trading_pair_id,
      p_buy_orders: sessionData.buy_orders,
      p_sell_orders: sessionData.sell_orders,
      p_clearing_price: sessionData.clearing_price,
      p_total_volume: sessionData.total_volume,
      p_matching_proof: sessionData.matching_proof,
      p_vrf_proof: sessionData.vrf_proof,
      p_price_discovery_proof: sessionData.price_discovery_proof,
    });

    if (error) throw new Error(`Failed to create matching session: ${error.message}`);
    return data;
  }

  async getMatchingSession(sessionId: string) {
    const { data, error } = await this.client
      .from('matching_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error) throw new Error(`Failed to get matching session: ${error.message}`);
    return data;
  }

  async getUserTrades(userId: string, limit: number = 50) {
    const { data, error } = await this.client
      .from('trades')
      .select(`
        *,
        matching_sessions (
          trading_pair_id,
          session_number
        ),
        buy_order:encrypted_orders!buy_order_id (
          trading_pair_id
        ),
        sell_order:encrypted_orders!sell_order_id (
          trading_pair_id
        )
      `)
      .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Failed to get user trades: ${error.message}`);
    return data || [];
  }

  // =====================================================
  // THRESHOLD OPERATIONS
  // =====================================================

  async initiateThresholdOperation(operationData: {
    matching_session_id: string;
    operation_type: 'partial_decrypt' | 'combine_shares' | 'verify_proof';
    encrypted_data: string;
    required_shares?: number;
    total_shares?: number;
  }) {
    const { data, error } = await this.client
      .from('threshold_operations')
      .insert(operationData)
      .select()
      .single();

    if (error) throw new Error(`Failed to initiate threshold operation: ${error.message}`);
    return data;
  }

  async submitExecutorResponse(responseData: {
    threshold_operation_id: string;
    executor_node_id: string;
    partial_result: string;
    proof_data: any;
    signature: string;
  }) {
    const { data, error } = await this.client.rpc('submit_executor_response', {
      p_threshold_operation_id: responseData.threshold_operation_id,
      p_executor_node_id: responseData.executor_node_id,
      p_partial_result: responseData.partial_result,
      p_proof_data: responseData.proof_data,
      p_signature: responseData.signature,
    });

    if (error) throw new Error(`Failed to submit executor response: ${error.message}`);
    return data;
  }

  async getExecutorNodes() {
    const { data, error } = await this.client
      .from('executor_nodes')
      .select('*')
      .order('node_id');

    if (error) throw new Error(`Failed to get executor nodes: ${error.message}`);
    return data || [];
  }

  // =====================================================
  // SYSTEM MONITORING
  // =====================================================

  async updateSystemHealth(component: string, healthData: {
    status: 'healthy' | 'degraded' | 'unhealthy' | 'offline';
    health_score: number;
    response_time?: number;
    throughput?: number;
    error_rate?: number;
    details?: any;
  }) {
    const { error } = await this.client.rpc('update_system_health', {
      p_component: component,
      p_status: healthData.status,
      p_health_score: healthData.health_score,
      p_response_time: healthData.response_time,
      p_throughput: healthData.throughput,
      p_error_rate: healthData.error_rate,
      p_details: healthData.details,
    });

    if (error) throw new Error(`Failed to update system health: ${error.message}`);
  }

  async getSystemHealth() {
    const { data, error } = await this.client
      .from('system_health_overview')
      .select('*')
      .order('health_score');

    if (error) throw new Error(`Failed to get system health: ${error.message}`);
    return data || [];
  }

  async recordMetric(metricData: {
    metric_name: string;
    metric_value: number;
    component?: string;
    trading_pair_id?: string;
    metric_unit?: string;
  }) {
    const { error } = await this.client.rpc('record_system_metric', {
      p_metric_name: metricData.metric_name,
      p_metric_value: metricData.metric_value,
      p_component: metricData.component,
      p_trading_pair_id: metricData.trading_pair_id,
      p_metric_unit: metricData.metric_unit,
    });

    if (error) throw new Error(`Failed to record metric: ${error.message}`);
  }

  // =====================================================
  // AUDIT & COMPLIANCE
  // =====================================================

  async logAuditEvent(eventData: {
    event_type: string;
    event_category: 'order' | 'matching' | 'execution' | 'admin' | 'security';
    user_id?: string;
    order_id?: string;
    matching_session_id?: string;
    event_data: any;
    ip_address?: string;
    user_agent?: string;
    risk_level?: 'low' | 'medium' | 'high' | 'critical';
    security_flags?: any;
  }) {
    const { error } = await this.client
      .from('audit_log')
      .insert(eventData);

    if (error) throw new Error(`Failed to log audit event: ${error.message}`);
  }

  async getAuditLogs(filters?: {
    user_id?: string;
    event_type?: string;
    start_date?: string;
    end_date?: string;
    limit?: number;
  }) {
    let query = this.client
      .from('audit_log')
      .select('*');

    if (filters?.user_id) {
      query = query.eq('user_id', filters.user_id);
    }
    if (filters?.event_type) {
      query = query.eq('event_type', filters.event_type);
    }
    if (filters?.start_date) {
      query = query.gte('created_at', filters.start_date);
    }
    if (filters?.end_date) {
      query = query.lte('created_at', filters.end_date);
    }

    query = query.order('created_at', { ascending: false });
    
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) throw new Error(`Failed to get audit logs: ${error.message}`);
    return data || [];
  }

  // =====================================================
  // REAL-TIME SUBSCRIPTIONS
  // =====================================================

  subscribeToOrderUpdates(userId: string, callback: (payload: any) => void) {
    return this.client
      .channel('order-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'encrypted_orders',
        filter: `user_id=eq.${userId}`,
      }, callback)
      .subscribe();
  }

  subscribeToMarketUpdates(tradingPairId: string, callback: (payload: any) => void) {
    return this.client
      .channel('market-updates')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'market_stats',
        filter: `trading_pair_id=eq.${tradingPairId}`,
      }, callback)
      .subscribe();
  }

  subscribeToTradeUpdates(userId: string, callback: (payload: any) => void) {
    return this.client
      .channel('trade-updates')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'trades',
        filter: `buyer_id=eq.${userId}`,
      }, callback)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'trades',
        filter: `seller_id=eq.${userId}`,
      }, callback)
      .subscribe();
  }

  subscribeToSystemHealth(callback: (payload: any) => void) {
    return this.client
      .channel('system-health')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'system_health',
      }, callback)
      .subscribe();
  }

  // =====================================================
  // UTILITY METHODS
  // =====================================================

  async cleanupExpiredOrders() {
    const { data, error } = await this.client.rpc('cleanup_expired_orders');
    if (error) throw new Error(`Failed to cleanup expired orders: ${error.message}`);
    return data;
  }

  async healthCheck() {
    const { data, error } = await this.client
      .from('system_health')
      .select('component, status, health_score')
      .limit(1);

    if (error) {
      return { healthy: false, error: error.message };
    }

    return { healthy: true, components: data };
  }
}

// Export singleton instance
export const db = new DatabaseService(supabase);

// Export types for use in other files
export type { SupabaseDatabase } from '../types/database';
export type DatabaseClient = SupabaseClient<SupabaseDatabase>;