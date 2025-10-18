-- Supabase Database Functions
-- Custom functions for PhantomPool operations

-- =====================================================
-- ORDER MANAGEMENT FUNCTIONS
-- =====================================================

-- Function to submit encrypted order with validation
CREATE OR REPLACE FUNCTION submit_encrypted_order(
    p_user_id UUID,
    p_trading_pair_id UUID,
    p_order_type TEXT,
    p_side TEXT,
    p_encrypted_amount TEXT,
    p_encrypted_price TEXT,
    p_solvency_proof JSONB,
    p_signature_proof TEXT,
    p_nonce TEXT,
    p_expiry_time TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order_id UUID;
    v_user_balance BIGINT;
    v_order_pool_id UUID;
BEGIN
    -- Validate user exists and is active
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id AND is_active = true) THEN
        RAISE EXCEPTION 'Invalid or inactive user';
    END IF;

    -- Validate trading pair exists and is active
    IF NOT EXISTS (SELECT 1 FROM public.trading_pairs WHERE id = p_trading_pair_id AND is_active = true) THEN
        RAISE EXCEPTION 'Invalid or inactive trading pair';
    END IF;

    -- Validate nonce is unique
    IF EXISTS (SELECT 1 FROM public.encrypted_orders WHERE nonce = p_nonce) THEN
        RAISE EXCEPTION 'Nonce already used';
    END IF;

    -- Insert the encrypted order
    INSERT INTO public.encrypted_orders (
        user_id,
        trading_pair_id,
        order_type,
        side,
        encrypted_amount,
        encrypted_price,
        solvency_proof,
        signature_proof,
        nonce,
        expires_at,
        status
    ) VALUES (
        p_user_id,
        p_trading_pair_id,
        p_order_type,
        p_side,
        p_encrypted_amount,
        p_encrypted_price,
        p_solvency_proof,
        p_signature_proof,
        p_nonce,
        p_expiry_time,
        'active'
    ) RETURNING id INTO v_order_id;

    -- Update order pool aggregations
    PERFORM update_order_pool_aggregation(p_trading_pair_id, p_side);

    -- Log the order submission
    INSERT INTO public.audit_log (event_type, event_category, user_id, order_id, event_data)
    VALUES ('order_submitted', 'order', p_user_id, v_order_id, 
            jsonb_build_object('order_type', p_order_type, 'side', p_side));

    RETURN v_order_id;
END;
$$;

-- Function to update order pool aggregations
CREATE OR REPLACE FUNCTION update_order_pool_aggregation(
    p_trading_pair_id UUID,
    p_side TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order_count INTEGER;
    v_pool_id UUID;
BEGIN
    -- Get current order count for the pool
    SELECT COUNT(*) INTO v_order_count
    FROM public.encrypted_orders
    WHERE trading_pair_id = p_trading_pair_id 
    AND side = p_side 
    AND status IN ('active', 'partially_filled');

    -- Update or create order pool
    INSERT INTO public.order_pools (trading_pair_id, side, order_count, vrf_seed)
    VALUES (p_trading_pair_id, p_side, v_order_count, encode(gen_random_bytes(32), 'hex'))
    ON CONFLICT (trading_pair_id, side)
    DO UPDATE SET 
        order_count = v_order_count,
        updated_at = NOW();
END;
$$;

-- =====================================================
-- MATCHING FUNCTIONS
-- =====================================================

-- Function to create matching session
CREATE OR REPLACE FUNCTION create_matching_session(
    p_trading_pair_id UUID,
    p_buy_orders UUID[],
    p_sell_orders UUID[],
    p_clearing_price BIGINT,
    p_total_volume BIGINT,
    p_matching_proof JSONB,
    p_vrf_proof JSONB,
    p_price_discovery_proof JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session_id UUID;
    v_session_number BIGINT;
BEGIN
    -- Get next session number
    SELECT COALESCE(MAX(session_number), 0) + 1 INTO v_session_number
    FROM public.matching_sessions
    WHERE trading_pair_id = p_trading_pair_id;

    -- Create matching session
    INSERT INTO public.matching_sessions (
        trading_pair_id,
        session_number,
        buy_orders_count,
        sell_orders_count,
        clearing_price,
        total_volume,
        matching_proof,
        vrf_proof,
        price_discovery_proof,
        matched_at
    ) VALUES (
        p_trading_pair_id,
        v_session_number,
        array_length(p_buy_orders, 1),
        array_length(p_sell_orders, 1),
        p_clearing_price,
        p_total_volume,
        p_matching_proof,
        p_vrf_proof,
        p_price_discovery_proof,
        NOW()
    ) RETURNING id INTO v_session_id;

    -- Log matching session creation
    INSERT INTO public.audit_log (event_type, event_category, matching_session_id, event_data)
    VALUES ('matching_session_created', 'matching', v_session_id,
            jsonb_build_object(
                'buy_orders_count', array_length(p_buy_orders, 1),
                'sell_orders_count', array_length(p_sell_orders, 1),
                'clearing_price', p_clearing_price,
                'total_volume', p_total_volume
            ));

    RETURN v_session_id;
END;
$$;

-- =====================================================
-- THRESHOLD DECRYPTION FUNCTIONS
-- =====================================================

-- Function to initiate threshold operation
CREATE OR REPLACE FUNCTION initiate_threshold_operation(
    p_matching_session_id UUID,
    p_operation_type TEXT,
    p_encrypted_data TEXT,
    p_required_shares INTEGER DEFAULT 3,
    p_total_shares INTEGER DEFAULT 5
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_operation_id UUID;
BEGIN
    -- Create threshold operation
    INSERT INTO public.threshold_operations (
        matching_session_id,
        operation_type,
        encrypted_data,
        required_shares,
        total_shares,
        status
    ) VALUES (
        p_matching_session_id,
        p_operation_type,
        p_encrypted_data,
        p_required_shares,
        p_total_shares,
        'pending'
    ) RETURNING id INTO v_operation_id;

    -- Log threshold operation initiation
    INSERT INTO public.audit_log (event_type, event_category, matching_session_id, event_data)
    VALUES ('threshold_operation_initiated', 'execution', p_matching_session_id,
            jsonb_build_object(
                'operation_id', v_operation_id,
                'operation_type', p_operation_type,
                'required_shares', p_required_shares
            ));

    RETURN v_operation_id;
END;
$$;

-- Function to submit executor response
CREATE OR REPLACE FUNCTION submit_executor_response(
    p_threshold_operation_id UUID,
    p_executor_node_id UUID,
    p_partial_result TEXT,
    p_proof_data JSONB,
    p_signature TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_shares_received INTEGER;
    v_required_shares INTEGER;
    v_operation_status TEXT;
BEGIN
    -- Insert executor response
    INSERT INTO public.executor_responses (
        threshold_operation_id,
        executor_node_id,
        partial_result,
        proof_data,
        signature,
        is_valid
    ) VALUES (
        p_threshold_operation_id,
        p_executor_node_id,
        p_partial_result,
        p_proof_data,
        p_signature,
        true -- Simplified validation
    ) ON CONFLICT (threshold_operation_id, executor_node_id)
    DO UPDATE SET
        partial_result = EXCLUDED.partial_result,
        proof_data = EXCLUDED.proof_data,
        signature = EXCLUDED.signature,
        is_valid = true;

    -- Update threshold operation with new share count
    UPDATE public.threshold_operations
    SET shares_received = (
        SELECT COUNT(*)
        FROM public.executor_responses
        WHERE threshold_operation_id = p_threshold_operation_id
        AND is_valid = true
    )
    WHERE id = p_threshold_operation_id;

    -- Check if we have enough shares
    SELECT shares_received, required_shares, status
    INTO v_shares_received, v_required_shares, v_operation_status
    FROM public.threshold_operations
    WHERE id = p_threshold_operation_id;

    -- If we have enough shares, mark as ready for combination
    IF v_shares_received >= v_required_shares AND v_operation_status = 'pending' THEN
        UPDATE public.threshold_operations
        SET status = 'in_progress'
        WHERE id = p_threshold_operation_id;
    END IF;

    RETURN true;
END;
$$;

-- =====================================================
-- ANALYTICS FUNCTIONS
-- =====================================================

-- Function to update market statistics
CREATE OR REPLACE FUNCTION update_market_statistics(
    p_trading_pair_id UUID,
    p_last_price BIGINT,
    p_volume BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_stats RECORD;
    v_price_change DECIMAL(10,4);
BEGIN
    -- Get current stats
    SELECT * INTO v_current_stats
    FROM public.market_stats
    WHERE trading_pair_id = p_trading_pair_id;

    -- Calculate price change
    IF v_current_stats.last_price IS NOT NULL AND v_current_stats.last_price > 0 THEN
        v_price_change := ((p_last_price::DECIMAL - v_current_stats.last_price::DECIMAL) / v_current_stats.last_price::DECIMAL) * 100;
    ELSE
        v_price_change := 0;
    END IF;

    -- Update market stats
    UPDATE public.market_stats
    SET 
        last_price = p_last_price,
        volume_24h = COALESCE(volume_24h, 0) + p_volume,
        high_24h = GREATEST(COALESCE(high_24h, p_last_price), p_last_price),
        low_24h = LEAST(COALESCE(low_24h, p_last_price), p_last_price),
        price_change_24h = v_price_change,
        updated_at = NOW()
    WHERE trading_pair_id = p_trading_pair_id;
END;
$$;

-- Function to record system metrics
CREATE OR REPLACE FUNCTION record_system_metric(
    p_metric_name TEXT,
    p_metric_value DECIMAL(15,6),
    p_component TEXT DEFAULT NULL,
    p_trading_pair_id UUID DEFAULT NULL,
    p_metric_unit TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.system_metrics (
        metric_name,
        metric_value,
        metric_unit,
        component,
        trading_pair_id,
        period_start,
        period_end
    ) VALUES (
        p_metric_name,
        p_metric_value,
        p_metric_unit,
        p_component,
        p_trading_pair_id,
        NOW(),
        NOW()
    );
END;
$$;

-- =====================================================
-- UTILITY FUNCTIONS
-- =====================================================

-- Function to get user orders with decrypted amounts (for user's own orders)
CREATE OR REPLACE FUNCTION get_user_orders(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    trading_pair_id UUID,
    order_type TEXT,
    side TEXT,
    status TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    base_token TEXT,
    quote_token TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        eo.id,
        eo.trading_pair_id,
        eo.order_type,
        eo.side,
        eo.status,
        eo.created_at,
        eo.expires_at,
        tp.base_token,
        tp.quote_token
    FROM public.encrypted_orders eo
    JOIN public.trading_pairs tp ON eo.trading_pair_id = tp.id
    WHERE eo.user_id = p_user_id
    ORDER BY eo.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- Function to clean up expired orders
CREATE OR REPLACE FUNCTION cleanup_expired_orders()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_cleaned_count INTEGER;
BEGIN
    -- Update expired orders
    UPDATE public.encrypted_orders
    SET status = 'expired', updated_at = NOW()
    WHERE status IN ('active', 'partially_filled')
    AND expires_at IS NOT NULL
    AND expires_at < NOW();

    GET DIAGNOSTICS v_cleaned_count = ROW_COUNT;

    -- Log cleanup operation
    IF v_cleaned_count > 0 THEN
        INSERT INTO public.audit_log (event_type, event_category, event_data)
        VALUES ('orders_expired', 'order', 
                jsonb_build_object('expired_count', v_cleaned_count));
    END IF;

    RETURN v_cleaned_count;
END;
$$;

-- Function to update system health
CREATE OR REPLACE FUNCTION update_system_health(
    p_component TEXT,
    p_status TEXT,
    p_health_score DECIMAL(5,2),
    p_response_time INTEGER DEFAULT NULL,
    p_throughput DECIMAL(10,2) DEFAULT NULL,
    p_error_rate DECIMAL(5,4) DEFAULT NULL,
    p_details JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.system_health (
        component,
        status,
        health_score,
        response_time,
        throughput,
        error_rate,
        details,
        last_check,
        updated_at
    ) VALUES (
        p_component,
        p_status,
        p_health_score,
        p_response_time,
        p_throughput,
        p_error_rate,
        p_details,
        NOW(),
        NOW()
    ) ON CONFLICT (component)
    DO UPDATE SET
        status = EXCLUDED.status,
        health_score = EXCLUDED.health_score,
        response_time = EXCLUDED.response_time,
        throughput = EXCLUDED.throughput,
        error_rate = EXCLUDED.error_rate,
        details = EXCLUDED.details,
        last_check = NOW(),
        updated_at = NOW();
END;
$$;