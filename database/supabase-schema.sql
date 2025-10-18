-- PhantomPool Supabase Database Schema
-- Comprehensive dark pool trading system with cryptographic proofs
-- Implements full audit trail and performance optimization

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- =====================================================
-- USER MANAGEMENT & AUTHENTICATION
-- =====================================================

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    wallet_address TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE,
    email TEXT,
    kyc_status TEXT DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'verified', 'rejected')),
    risk_score DECIMAL(5,2) DEFAULT 0.00,
    trading_tier TEXT DEFAULT 'basic' CHECK (trading_tier IN ('basic', 'premium', 'institutional')),
    max_order_size BIGINT DEFAULT 1000000, -- In micro-units
    daily_volume_limit BIGINT DEFAULT 10000000,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- User balances with cryptographic commitments
CREATE TABLE public.user_balances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token_mint TEXT NOT NULL,
    balance BIGINT NOT NULL DEFAULT 0,
    available_balance BIGINT NOT NULL DEFAULT 0,
    locked_balance BIGINT NOT NULL DEFAULT 0,
    balance_commitment TEXT, -- Pedersen commitment for privacy
    last_solvency_proof TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, token_mint)
);

-- =====================================================
-- TRADING PAIRS & MARKETS
-- =====================================================

-- Supported trading pairs
CREATE TABLE public.trading_pairs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    base_token TEXT NOT NULL,
    quote_token TEXT NOT NULL,
    base_token_name TEXT NOT NULL,
    quote_token_name TEXT NOT NULL,
    base_decimals INTEGER NOT NULL DEFAULT 9,
    quote_decimals INTEGER NOT NULL DEFAULT 6,
    min_order_size BIGINT NOT NULL DEFAULT 1000,
    max_order_size BIGINT NOT NULL DEFAULT 1000000000,
    tick_size BIGINT NOT NULL DEFAULT 1000, -- Minimum price increment
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(base_token, quote_token)
);

-- Market statistics
CREATE TABLE public.market_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trading_pair_id UUID NOT NULL REFERENCES public.trading_pairs(id) ON DELETE CASCADE,
    last_price BIGINT,
    volume_24h BIGINT DEFAULT 0,
    high_24h BIGINT,
    low_24h BIGINT,
    price_change_24h DECIMAL(10,4),
    total_orders INTEGER DEFAULT 0,
    active_buy_orders INTEGER DEFAULT 0,
    active_sell_orders INTEGER DEFAULT 0,
    liquidity_depth BIGINT DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- ENCRYPTED ORDERS & ORDER BOOK
-- =====================================================

-- Encrypted orders (core of dark pool)
CREATE TABLE public.encrypted_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    trading_pair_id UUID NOT NULL REFERENCES public.trading_pairs(id) ON DELETE CASCADE,
    order_type TEXT NOT NULL CHECK (order_type IN ('market', 'limit')),
    side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
    
    -- Encrypted order data (ElGamal ciphertexts)
    encrypted_amount TEXT NOT NULL, -- JSON serialized ElGamal ciphertext
    encrypted_price TEXT NOT NULL,  -- JSON serialized ElGamal ciphertext
    
    -- Cryptographic proofs
    solvency_proof JSONB NOT NULL, -- Bulletproof+ solvency proof
    range_proof JSONB,             -- Range proof for amount/price
    signature_proof TEXT NOT NULL, -- Order signature
    
    -- Order metadata
    nonce TEXT NOT NULL UNIQUE,
    expiry_time TIMESTAMP WITH TIME ZONE,
    min_fill_amount BIGINT,
    
    -- Status tracking
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'partially_filled', 'filled', 'cancelled', 'expired')),
    filled_amount BIGINT DEFAULT 0,
    remaining_amount BIGINT DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    activated_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE
);

-- Order pool aggregations for efficient matching
CREATE TABLE public.order_pools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trading_pair_id UUID NOT NULL REFERENCES public.trading_pairs(id) ON DELETE CASCADE,
    side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
    
    -- Aggregated commitments (homomorphic)
    aggregated_amount_commitment TEXT,
    aggregated_price_commitment TEXT,
    order_count INTEGER DEFAULT 0,
    
    -- VRF for fair ordering
    vrf_seed TEXT NOT NULL,
    vrf_proof JSONB,
    
    -- Batch proofs
    batch_solvency_proof JSONB,
    batch_range_proof JSONB,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(trading_pair_id, side)
);

-- =====================================================
-- MATCHING & EXECUTION
-- =====================================================

-- Matching sessions (when orders are matched)
CREATE TABLE public.matching_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trading_pair_id UUID NOT NULL REFERENCES public.trading_pairs(id) ON DELETE CASCADE,
    
    -- Session metadata
    session_number BIGINT NOT NULL,
    buy_orders_count INTEGER NOT NULL DEFAULT 0,
    sell_orders_count INTEGER NOT NULL DEFAULT 0,
    
    -- Price discovery
    clearing_price BIGINT,
    total_volume BIGINT DEFAULT 0,
    
    -- Cryptographic proofs
    matching_proof JSONB, -- ZK proof of correct matching
    vrf_proof JSONB,      -- Fair ordering proof
    price_discovery_proof JSONB, -- Price calculation proof
    
    -- Execution details
    execution_transaction TEXT, -- Solana transaction signature
    execution_status TEXT DEFAULT 'pending' CHECK (execution_status IN ('pending', 'executing', 'completed', 'failed')),
    
    -- Executor coordination
    executor_assignments JSONB, -- Which executors handle this session
    threshold_shares JSONB,     -- Secret shares for decryption
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    matched_at TIMESTAMP WITH TIME ZONE,
    executed_at TIMESTAMP WITH TIME ZONE
);

-- Individual trades within matching sessions
CREATE TABLE public.trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    matching_session_id UUID NOT NULL REFERENCES public.matching_sessions(id) ON DELETE CASCADE,
    
    -- Trade participants
    buy_order_id UUID NOT NULL REFERENCES public.encrypted_orders(id) ON DELETE CASCADE,
    sell_order_id UUID NOT NULL REFERENCES public.encrypted_orders(id) ON DELETE CASCADE,
    buyer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    
    -- Trade details (revealed after execution)
    amount BIGINT NOT NULL,
    price BIGINT NOT NULL,
    total_value BIGINT NOT NULL,
    
    -- Fees
    buyer_fee BIGINT DEFAULT 0,
    seller_fee BIGINT DEFAULT 0,
    protocol_fee BIGINT DEFAULT 0,
    
    -- Settlement
    settlement_signature TEXT, -- Blockchain transaction
    settlement_status TEXT DEFAULT 'pending' CHECK (settlement_status IN ('pending', 'confirmed', 'failed')),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    settled_at TIMESTAMP WITH TIME ZONE
);

-- =====================================================
-- THRESHOLD DECRYPTION NETWORK
-- =====================================================

-- Executor nodes in the threshold network
CREATE TABLE public.executor_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id INTEGER NOT NULL UNIQUE, -- 1-5 for the threshold network
    
    -- Node identity
    public_key TEXT NOT NULL UNIQUE,
    endpoint_url TEXT NOT NULL,
    
    -- Status monitoring
    status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'degraded', 'maintenance')),
    last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Performance metrics
    total_requests BIGINT DEFAULT 0,
    successful_requests BIGINT DEFAULT 0,
    avg_response_time INTEGER DEFAULT 0, -- milliseconds
    error_count INTEGER DEFAULT 0,
    
    -- Health check
    health_score DECIMAL(5,2) DEFAULT 100.00,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Threshold decryption operations
CREATE TABLE public.threshold_operations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    matching_session_id UUID NOT NULL REFERENCES public.matching_sessions(id) ON DELETE CASCADE,
    operation_type TEXT NOT NULL CHECK (operation_type IN ('partial_decrypt', 'combine_shares', 'verify_proof')),
    
    -- Threshold parameters
    required_shares INTEGER NOT NULL DEFAULT 3,
    total_shares INTEGER NOT NULL DEFAULT 5,
    
    -- Operation data
    encrypted_data TEXT NOT NULL,
    shares_received INTEGER DEFAULT 0,
    partial_results JSONB DEFAULT '{}'::jsonb,
    combined_result TEXT,
    
    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Individual executor responses for threshold operations
CREATE TABLE public.executor_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    threshold_operation_id UUID NOT NULL REFERENCES public.threshold_operations(id) ON DELETE CASCADE,
    executor_node_id UUID NOT NULL REFERENCES public.executor_nodes(id) ON DELETE CASCADE,
    
    -- Response data
    partial_result TEXT,
    proof_data JSONB,
    signature TEXT NOT NULL,
    
    -- Validation
    is_valid BOOLEAN DEFAULT false,
    validation_error TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(threshold_operation_id, executor_node_id)
);

-- =====================================================
-- CRYPTOGRAPHIC PROOFS & AUDIT
-- =====================================================

-- Proof storage and verification
CREATE TABLE public.cryptographic_proofs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    proof_type TEXT NOT NULL CHECK (proof_type IN ('solvency', 'range', 'matching', 'vrf', 'execution', 'shuffle')),
    
    -- Associated records
    order_id UUID REFERENCES public.encrypted_orders(id) ON DELETE CASCADE,
    matching_session_id UUID REFERENCES public.matching_sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    
    -- Proof data
    proof_data JSONB NOT NULL,
    public_inputs JSONB,
    verification_key JSONB,
    
    -- Verification status
    is_verified BOOLEAN DEFAULT false,
    verification_time TIMESTAMP WITH TIME ZONE,
    verifier_node TEXT,
    
    -- Metadata
    proof_size INTEGER,
    generation_time INTEGER, -- milliseconds
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit log for all system operations
CREATE TABLE public.audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Event details
    event_type TEXT NOT NULL,
    event_category TEXT NOT NULL CHECK (event_category IN ('order', 'matching', 'execution', 'admin', 'security')),
    
    -- Context
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    order_id UUID REFERENCES public.encrypted_orders(id) ON DELETE SET NULL,
    matching_session_id UUID REFERENCES public.matching_sessions(id) ON DELETE SET NULL,
    
    -- Event data
    event_data JSONB DEFAULT '{}'::jsonb,
    ip_address INET,
    user_agent TEXT,
    
    -- Risk & security
    risk_level TEXT DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    security_flags JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- SYSTEM METRICS & MONITORING
-- =====================================================

-- System performance metrics
CREATE TABLE public.system_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_name TEXT NOT NULL,
    metric_value DECIMAL(15,6) NOT NULL,
    metric_unit TEXT,
    
    -- Context
    component TEXT, -- 'matching', 'execution', 'crypto', 'api'
    trading_pair_id UUID REFERENCES public.trading_pairs(id) ON DELETE SET NULL,
    
    -- Aggregation period
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Real-time system health
CREATE TABLE public.system_health (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    component TEXT NOT NULL UNIQUE,
    
    -- Health status
    status TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'unhealthy', 'offline')),
    health_score DECIMAL(5,2) NOT NULL DEFAULT 100.00,
    
    -- Metrics
    response_time INTEGER, -- milliseconds
    throughput DECIMAL(10,2), -- operations per second
    error_rate DECIMAL(5,4), -- percentage
    
    -- Detailed status
    details JSONB DEFAULT '{}'::jsonb,
    
    last_check TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Users indexes
CREATE INDEX idx_users_wallet_address ON public.users(wallet_address);
CREATE INDEX idx_users_auth_user_id ON public.users(auth_user_id);
CREATE INDEX idx_users_created_at ON public.users(created_at DESC);
CREATE INDEX idx_users_kyc_status ON public.users(kyc_status) WHERE kyc_status != 'verified';

-- User balances indexes
CREATE INDEX idx_user_balances_user_token ON public.user_balances(user_id, token_mint);
CREATE INDEX idx_user_balances_updated_at ON public.user_balances(updated_at DESC);

-- Trading pairs indexes
CREATE INDEX idx_trading_pairs_active ON public.trading_pairs(is_active) WHERE is_active = true;
CREATE INDEX idx_trading_pairs_tokens ON public.trading_pairs(base_token, quote_token);

-- Orders indexes
CREATE INDEX idx_encrypted_orders_user_id ON public.encrypted_orders(user_id);
CREATE INDEX idx_encrypted_orders_trading_pair ON public.encrypted_orders(trading_pair_id);
CREATE INDEX idx_encrypted_orders_status ON public.encrypted_orders(status);
CREATE INDEX idx_encrypted_orders_side_status ON public.encrypted_orders(side, status);
CREATE INDEX idx_encrypted_orders_created_at ON public.encrypted_orders(created_at DESC);
CREATE INDEX idx_encrypted_orders_expires_at ON public.encrypted_orders(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_encrypted_orders_nonce ON public.encrypted_orders(nonce);

-- Matching sessions indexes
CREATE INDEX idx_matching_sessions_trading_pair ON public.matching_sessions(trading_pair_id);
CREATE INDEX idx_matching_sessions_created_at ON public.matching_sessions(created_at DESC);
CREATE INDEX idx_matching_sessions_status ON public.matching_sessions(execution_status);

-- Trades indexes
CREATE INDEX idx_trades_matching_session ON public.trades(matching_session_id);
CREATE INDEX idx_trades_buyer_seller ON public.trades(buyer_id, seller_id);
CREATE INDEX idx_trades_created_at ON public.trades(created_at DESC);
CREATE INDEX idx_trades_settlement_status ON public.trades(settlement_status);

-- Executor nodes indexes
CREATE INDEX idx_executor_nodes_status ON public.executor_nodes(status);
CREATE INDEX idx_executor_nodes_health ON public.executor_nodes(health_score DESC);
CREATE INDEX idx_executor_nodes_heartbeat ON public.executor_nodes(last_heartbeat DESC);

-- Threshold operations indexes
CREATE INDEX idx_threshold_operations_matching_session ON public.threshold_operations(matching_session_id);
CREATE INDEX idx_threshold_operations_status ON public.threshold_operations(status);
CREATE INDEX idx_threshold_operations_created_at ON public.threshold_operations(created_at DESC);

-- Proofs indexes
CREATE INDEX idx_cryptographic_proofs_type ON public.cryptographic_proofs(proof_type);
CREATE INDEX idx_cryptographic_proofs_order_id ON public.cryptographic_proofs(order_id);
CREATE INDEX idx_cryptographic_proofs_verified ON public.cryptographic_proofs(is_verified);
CREATE INDEX idx_cryptographic_proofs_created_at ON public.cryptographic_proofs(created_at DESC);

-- Audit log indexes
CREATE INDEX idx_audit_log_user_id ON public.audit_log(user_id);
CREATE INDEX idx_audit_log_event_type ON public.audit_log(event_type);
CREATE INDEX idx_audit_log_created_at ON public.audit_log(created_at DESC);
CREATE INDEX idx_audit_log_risk_level ON public.audit_log(risk_level) WHERE risk_level IN ('high', 'critical');

-- Metrics indexes
CREATE INDEX idx_system_metrics_component ON public.system_metrics(component);
CREATE INDEX idx_system_metrics_name_period ON public.system_metrics(metric_name, period_start DESC);
CREATE INDEX idx_system_health_status ON public.system_health(status, updated_at DESC);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encrypted_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = auth_user_id);

-- Users can only see their own balances
CREATE POLICY "Users can view own balances" ON public.user_balances
    FOR SELECT USING (
        user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
    );

-- Users can only see their own orders
CREATE POLICY "Users can view own orders" ON public.encrypted_orders
    FOR SELECT USING (
        user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
    );

CREATE POLICY "Users can create orders" ON public.encrypted_orders
    FOR INSERT WITH CHECK (
        user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
    );

-- Users can only see their own trades
CREATE POLICY "Users can view own trades" ON public.trades
    FOR SELECT USING (
        buyer_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()) OR
        seller_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
    );

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_balances_updated_at BEFORE UPDATE ON public.user_balances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_encrypted_orders_updated_at BEFORE UPDATE ON public.encrypted_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate remaining order amount
CREATE OR REPLACE FUNCTION calculate_remaining_amount()
RETURNS TRIGGER AS $$
BEGIN
    -- This is a simplified version - in practice, amount would be decrypted
    NEW.remaining_amount = COALESCE(NEW.remaining_amount, 0);
    
    -- Update order status based on fill
    IF NEW.filled_amount >= NEW.remaining_amount THEN
        NEW.status = 'filled';
    ELSIF NEW.filled_amount > 0 THEN
        NEW.status = 'partially_filled';
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER calculate_order_remaining_amount BEFORE UPDATE ON public.encrypted_orders
    FOR EACH ROW EXECUTE FUNCTION calculate_remaining_amount();

-- =====================================================
-- VIEWS FOR ANALYTICS
-- =====================================================

-- Market overview view
CREATE VIEW public.market_overview AS
SELECT 
    tp.id,
    tp.base_token,
    tp.quote_token,
    tp.base_token_name,
    tp.quote_token_name,
    ms.last_price,
    ms.volume_24h,
    ms.price_change_24h,
    ms.total_orders,
    ms.active_buy_orders,
    ms.active_sell_orders,
    ms.updated_at
FROM public.trading_pairs tp
LEFT JOIN public.market_stats ms ON tp.id = ms.trading_pair_id
WHERE tp.is_active = true;

-- User trading statistics
CREATE VIEW public.user_trading_stats AS
SELECT 
    u.id,
    u.wallet_address,
    COUNT(eo.id) as total_orders,
    COUNT(CASE WHEN eo.status = 'filled' THEN 1 END) as filled_orders,
    COUNT(t.id) as total_trades,
    COALESCE(SUM(t.total_value), 0) as total_volume,
    MAX(eo.created_at) as last_order_time,
    MAX(t.created_at) as last_trade_time
FROM public.users u
LEFT JOIN public.encrypted_orders eo ON u.id = eo.user_id
LEFT JOIN public.trades t ON u.id = t.buyer_id OR u.id = t.seller_id
GROUP BY u.id, u.wallet_address;

-- System health overview
CREATE VIEW public.system_health_overview AS
SELECT 
    component,
    status,
    health_score,
    response_time,
    throughput,
    error_rate,
    last_check,
    CASE 
        WHEN last_check < NOW() - INTERVAL '5 minutes' THEN 'stale'
        ELSE 'current'
    END as data_freshness
FROM public.system_health
ORDER BY health_score ASC;

-- =====================================================
-- INITIAL DATA
-- =====================================================

-- Insert default trading pairs
INSERT INTO public.trading_pairs (base_token, quote_token, base_token_name, quote_token_name) VALUES
    ('So11111111111111111111111111111111111111112', 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 'SOL', 'USDC'),
    ('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 'USDT', 'USDC'),
    ('So11111111111111111111111111111111111111112', 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', 'SOL', 'USDT');

-- Initialize market stats for trading pairs
INSERT INTO public.market_stats (trading_pair_id, last_price, volume_24h, high_24h, low_24h)
SELECT 
    id,
    150000000, -- $150 in micro-units
    0,
    150000000,
    150000000
FROM public.trading_pairs;

-- Initialize executor nodes (5-node threshold network)
INSERT INTO public.executor_nodes (node_id, public_key, endpoint_url, status) VALUES
    (1, 'executor1_pubkey_placeholder', 'https://executor1.phantompool.io', 'online'),
    (2, 'executor2_pubkey_placeholder', 'https://executor2.phantompool.io', 'online'),
    (3, 'executor3_pubkey_placeholder', 'https://executor3.phantompool.io', 'online'),
    (4, 'executor4_pubkey_placeholder', 'https://executor4.phantompool.io', 'online'),
    (5, 'executor5_pubkey_placeholder', 'https://executor5.phantompool.io', 'online');

-- Initialize system health components
INSERT INTO public.system_health (component, status, health_score) VALUES
    ('matching_engine', 'healthy', 100.00),
    ('threshold_network', 'healthy', 100.00),
    ('crypto_services', 'healthy', 100.00),
    ('api_gateway', 'healthy', 100.00),
    ('websocket_service', 'healthy', 100.00),
    ('database', 'healthy', 100.00);

-- Create order pools for each trading pair and side
INSERT INTO public.order_pools (trading_pair_id, side, vrf_seed)
SELECT 
    tp.id,
    s.side,
    encode(gen_random_bytes(32), 'hex')
FROM public.trading_pairs tp
CROSS JOIN (VALUES ('buy'), ('sell')) s(side);

COMMENT ON SCHEMA public IS 'PhantomPool Dark Pool Trading System - Complete database schema with cryptographic proofs, threshold decryption, and comprehensive audit trails';