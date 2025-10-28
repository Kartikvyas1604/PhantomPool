-- PhantomPool Database Schema
-- Production-grade PostgreSQL schema with encryption at rest and advanced security

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create schema for PhantomPool
CREATE SCHEMA IF NOT EXISTS phantom_pool;
SET search_path TO phantom_pool, public;

-- User management with multi-factor authentication
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_address VARCHAR(44) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    username VARCHAR(50) UNIQUE,
    encrypted_private_data JSONB, -- Encrypted personal information
    kyc_status VARCHAR(20) DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'verified', 'rejected')),
    risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
    is_active BOOLEAN DEFAULT true,
    two_factor_enabled BOOLEAN DEFAULT false,
    two_factor_secret VARCHAR(32),
    last_login_at TIMESTAMP WITH TIME ZONE,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit trail for user activities
CREATE TABLE user_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Dark pool configuration
CREATE TABLE dark_pools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    base_token_mint VARCHAR(44) NOT NULL,
    quote_token_mint VARCHAR(44) NOT NULL,
    elgamal_public_key BYTEA NOT NULL,
    vrf_public_key BYTEA NOT NULL,
    min_order_size BIGINT NOT NULL,
    max_order_size BIGINT NOT NULL,
    fee_bps INTEGER NOT NULL CHECK (fee_bps >= 0 AND fee_bps <= 1000),
    matching_interval_seconds INTEGER DEFAULT 30,
    is_active BOOLEAN DEFAULT true,
    total_volume BIGINT DEFAULT 0,
    total_trades BIGINT DEFAULT 0,
    total_fees_collected BIGINT DEFAULT 0,
    on_chain_address VARCHAR(44) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Encrypted orders with zero-knowledge proofs
CREATE TABLE encrypted_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    dark_pool_id UUID REFERENCES dark_pools(id) ON DELETE CASCADE,
    on_chain_order_id VARCHAR(44),
    order_side VARCHAR(4) NOT NULL CHECK (order_side IN ('buy', 'sell')),
    encrypted_amount BYTEA NOT NULL, -- ElGamal encrypted amount
    encrypted_price BYTEA NOT NULL,  -- ElGamal encrypted price
    amount_commitment BYTEA NOT NULL, -- Pedersen commitment for amount
    price_commitment BYTEA NOT NULL,  -- Pedersen commitment for price
    range_proof BYTEA NOT NULL,      -- Bulletproof for positive amount
    solvency_proof BYTEA NOT NULL,   -- Bulletproof for solvency
    vrf_proof BYTEA NOT NULL,        -- VRF proof for fairness
    order_hash BYTEA UNIQUE NOT NULL,
    deposit_amount BIGINT NOT NULL,
    escrow_account VARCHAR(44),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'matched', 'partially_filled', 'cancelled', 'expired', 'settled')),
    matching_round_id UUID,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    matched_at TIMESTAMP WITH TIME ZONE,
    settled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Matching rounds with verifiable randomness
CREATE TABLE matching_rounds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dark_pool_id UUID REFERENCES dark_pools(id) ON DELETE CASCADE,
    round_number BIGINT NOT NULL,
    vrf_proof BYTEA NOT NULL,
    vrf_randomness BYTEA NOT NULL,
    shuffled_order_list JSONB NOT NULL, -- VRF-shuffled order hashes
    clearing_price BIGINT,
    total_matched_volume BIGINT DEFAULT 0,
    total_matched_orders INTEGER DEFAULT 0,
    total_fees BIGINT DEFAULT 0,
    matching_proof BYTEA, -- Zero-knowledge proof of correct matching
    threshold_signature BYTEA, -- 3-of-5 threshold signature
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trade executions with full audit trail
CREATE TABLE trade_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    matching_round_id UUID REFERENCES matching_rounds(id) ON DELETE CASCADE,
    buy_order_id UUID REFERENCES encrypted_orders(id),
    sell_order_id UUID REFERENCES encrypted_orders(id),
    buy_user_id UUID REFERENCES users(id),
    sell_user_id UUID REFERENCES users(id),
    amount BIGINT NOT NULL,
    price BIGINT NOT NULL,
    total_value BIGINT NOT NULL,
    fee_amount BIGINT NOT NULL,
    buy_fee BIGINT NOT NULL,
    sell_fee BIGINT NOT NULL,
    on_chain_transaction_id VARCHAR(100),
    settlement_status VARCHAR(20) DEFAULT 'pending' CHECK (settlement_status IN ('pending', 'executing', 'completed', 'failed')),
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    settled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Executor network for threshold decryption
CREATE TABLE executor_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id VARCHAR(100) UNIQUE NOT NULL,
    public_key BYTEA NOT NULL,
    stake_amount BIGINT NOT NULL,
    wallet_address VARCHAR(44) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    last_heartbeat TIMESTAMP WITH TIME ZONE,
    successful_rounds BIGINT DEFAULT 0,
    total_rounds BIGINT DEFAULT 0,
    reputation_score DECIMAL(5,2) DEFAULT 100.00,
    slash_count INTEGER DEFAULT 0,
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Threshold decryption shares
CREATE TABLE decryption_shares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    matching_round_id UUID REFERENCES matching_rounds(id) ON DELETE CASCADE,
    executor_node_id UUID REFERENCES executor_nodes(id),
    share_data BYTEA NOT NULL,
    share_proof BYTEA NOT NULL,
    is_valid BOOLEAN DEFAULT false,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Financial safety monitoring
CREATE TABLE risk_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    user_id UUID REFERENCES users(id),
    order_id UUID REFERENCES encrypted_orders(id),
    details JSONB NOT NULL,
    automated_action VARCHAR(100),
    manual_review_required BOOLEAN DEFAULT false,
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- System-wide metrics and monitoring
CREATE TABLE system_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(20,8) NOT NULL,
    tags JSONB,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Emergency halt mechanisms
CREATE TABLE emergency_halts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dark_pool_id UUID REFERENCES dark_pools(id),
    reason TEXT NOT NULL,
    triggered_by UUID REFERENCES users(id),
    halt_type VARCHAR(20) CHECK (halt_type IN ('soft', 'hard', 'circuit_breaker')),
    auto_resume_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Wallet balances and escrow tracking
CREATE TABLE user_balances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token_mint VARCHAR(44) NOT NULL,
    available_balance BIGINT DEFAULT 0,
    locked_balance BIGINT DEFAULT 0, -- In orders
    escrow_balance BIGINT DEFAULT 0, -- In on-chain escrow
    total_deposited BIGINT DEFAULT 0,
    total_withdrawn BIGINT DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, token_mint)
);

-- Balance movement audit trail
CREATE TABLE balance_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token_mint VARCHAR(44) NOT NULL,
    movement_type VARCHAR(20) CHECK (movement_type IN ('deposit', 'withdrawal', 'lock', 'unlock', 'escrow_in', 'escrow_out', 'fee', 'trade')),
    amount BIGINT NOT NULL,
    balance_before BIGINT NOT NULL,
    balance_after BIGINT NOT NULL,
    reference_id UUID, -- Links to order, trade, etc.
    on_chain_transaction VARCHAR(100),
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_users_wallet_address ON users(wallet_address);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at DESC);

CREATE INDEX idx_encrypted_orders_user_id ON encrypted_orders(user_id);
CREATE INDEX idx_encrypted_orders_dark_pool_id ON encrypted_orders(dark_pool_id);
CREATE INDEX idx_encrypted_orders_status ON encrypted_orders(status);
CREATE INDEX idx_encrypted_orders_submitted_at ON encrypted_orders(submitted_at DESC);
CREATE INDEX idx_encrypted_orders_order_hash ON encrypted_orders(order_hash);

CREATE INDEX idx_matching_rounds_dark_pool_id ON matching_rounds(dark_pool_id);
CREATE INDEX idx_matching_rounds_round_number ON matching_rounds(round_number);
CREATE INDEX idx_matching_rounds_status ON matching_rounds(status);
CREATE INDEX idx_matching_rounds_started_at ON matching_rounds(started_at DESC);

CREATE INDEX idx_trade_executions_matching_round_id ON trade_executions(matching_round_id);
CREATE INDEX idx_trade_executions_buy_user_id ON trade_executions(buy_user_id);
CREATE INDEX idx_trade_executions_sell_user_id ON trade_executions(sell_user_id);
CREATE INDEX idx_trade_executions_executed_at ON trade_executions(executed_at DESC);

CREATE INDEX idx_executor_nodes_is_active ON executor_nodes(is_active);
CREATE INDEX idx_executor_nodes_reputation_score ON executor_nodes(reputation_score DESC);

CREATE INDEX idx_user_balances_user_token ON user_balances(user_id, token_mint);
CREATE INDEX idx_balance_movements_user_id ON balance_movements(user_id);
CREATE INDEX idx_balance_movements_created_at ON balance_movements(created_at DESC);

CREATE INDEX idx_risk_events_severity ON risk_events(severity);
CREATE INDEX idx_risk_events_resolved ON risk_events(resolved);
CREATE INDEX idx_risk_events_user_id ON risk_events(user_id);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_dark_pools_updated_at BEFORE UPDATE ON dark_pools FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_encrypted_orders_updated_at BEFORE UPDATE ON encrypted_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_executor_nodes_updated_at BEFORE UPDATE ON executor_nodes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) for data isolation
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE encrypted_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE balance_movements ENABLE ROW LEVEL SECURITY;

-- Create policies for user data access
CREATE POLICY user_data_policy ON users
    FOR ALL TO authenticated_users
    USING (wallet_address = current_setting('app.current_user_wallet', true));

CREATE POLICY order_data_policy ON encrypted_orders
    FOR ALL TO authenticated_users
    USING (user_id = (SELECT id FROM users WHERE wallet_address = current_setting('app.current_user_wallet', true)));

-- Views for analytics and monitoring
CREATE VIEW active_orders_summary AS
SELECT 
    dp.name as pool_name,
    eo.order_side,
    COUNT(*) as order_count,
    SUM(eo.deposit_amount) as total_volume
FROM encrypted_orders eo
JOIN dark_pools dp ON eo.dark_pool_id = dp.id
WHERE eo.status = 'pending'
GROUP BY dp.name, eo.order_side;

CREATE VIEW daily_trading_stats AS
SELECT 
    DATE(te.executed_at) as trade_date,
    dp.name as pool_name,
    COUNT(*) as trade_count,
    SUM(te.total_value) as total_volume,
    SUM(te.fee_amount) as total_fees,
    AVG(te.price) as avg_price
FROM trade_executions te
JOIN matching_rounds mr ON te.matching_round_id = mr.id
JOIN dark_pools dp ON mr.dark_pool_id = dp.id
WHERE te.settlement_status = 'completed'
GROUP BY DATE(te.executed_at), dp.name
ORDER BY trade_date DESC;

CREATE VIEW user_trading_summary AS
SELECT 
    u.wallet_address,
    COUNT(DISTINCT eo.id) as total_orders,
    COUNT(DISTINCT te.id) as total_trades,
    SUM(CASE WHEN te.buy_user_id = u.id THEN te.total_value ELSE 0 END) as total_bought,
    SUM(CASE WHEN te.sell_user_id = u.id THEN te.total_value ELSE 0 END) as total_sold,
    SUM(CASE WHEN te.buy_user_id = u.id THEN te.buy_fee WHEN te.sell_user_id = u.id THEN te.sell_fee ELSE 0 END) as total_fees_paid
FROM users u
LEFT JOIN encrypted_orders eo ON u.id = eo.user_id
LEFT JOIN trade_executions te ON u.id IN (te.buy_user_id, te.sell_user_id)
GROUP BY u.id, u.wallet_address;

-- Functions for encryption at rest
CREATE OR REPLACE FUNCTION encrypt_sensitive_data(data TEXT, key TEXT DEFAULT 'phantom_pool_encryption_key_2024')
RETURNS BYTEA AS $$
BEGIN
    RETURN pgp_sym_encrypt(data, key);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrypt_sensitive_data(encrypted_data BYTEA, key TEXT DEFAULT 'phantom_pool_encryption_key_2024')
RETURNS TEXT AS $$
BEGIN
    RETURN pgp_sym_decrypt(encrypted_data, key);
END;
$$ LANGUAGE plpgsql;

-- Zero-downtime migration support
CREATE TABLE schema_migrations (
    version VARCHAR(14) PRIMARY KEY,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Initial data
INSERT INTO schema_migrations (version) VALUES ('20241201000001');

-- Comments for documentation
COMMENT ON SCHEMA phantom_pool IS 'PhantomPool dark pool trading platform schema';
COMMENT ON TABLE users IS 'User accounts with KYC and security features';
COMMENT ON TABLE encrypted_orders IS 'Encrypted orders with zero-knowledge proofs';
COMMENT ON TABLE matching_rounds IS 'Batched matching rounds with VRF fairness';
COMMENT ON TABLE trade_executions IS 'Executed trades with full audit trail';
COMMENT ON TABLE executor_nodes IS 'Threshold decryption executor network';
COMMENT ON TABLE risk_events IS 'Financial safety and risk monitoring events';
COMMENT ON TABLE user_balances IS 'User token balances and escrow tracking';

-- Grant permissions (to be customized based on deployment)
-- GRANT USAGE ON SCHEMA phantom_pool TO phantom_pool_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA phantom_pool TO phantom_pool_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA phantom_pool TO phantom_pool_app;