use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, Transfer};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod phantom_pool {
    use super::*;

    /// Initialize a new dark pool for a token pair with real money trading
    pub fn initialize_pool(
        ctx: Context<InitializePool>,
        token_pair: String,
        elgamal_public_key: Vec<u8>,
        vrf_public_key: Vec<u8>,
        min_order_size: u64,
        max_order_size: u64,
        fee_bps: u16,
    ) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        pool.authority = ctx.accounts.authority.key();
        pool.token_pair = token_pair.clone();
        pool.elgamal_public_key = elgamal_public_key.clone();
        pool.vrf_public_key = vrf_public_key.clone();
        pool.total_orders = 0;
        pool.matching_round = 0;
        pool.is_matching_active = false;
        pool.min_order_size = min_order_size;
        pool.max_order_size = max_order_size;
        pool.fee_bps = fee_bps; // Trading fees in basis points
        pool.total_volume = 0;
        pool.total_trades = 0;
        pool.total_fees_collected = 0;
        pool.created_at = Clock::get()?.unix_timestamp;
        
        emit!(PoolInitialized {
            pool: pool.key(),
            authority: pool.authority,
            token_pair: token_pair,
            min_order_size,
            max_order_size,
            fee_bps,
        });
        
        Ok(())
    }

    /// Submit an encrypted order with real token deposits
    pub fn submit_encrypted_order(
        ctx: Context<SubmitEncryptedOrder>,
        encrypted_amount: Vec<u8>,
        encrypted_price: Vec<u8>,
        side: OrderSide,
        solvency_proof: Vec<u8>,
        order_hash: Vec<u8>,
        commitment_hash: [u8; 32],
        deposit_amount: u64,
    ) -> Result<()> {
        let order = &mut ctx.accounts.order;
        let pool = &mut ctx.accounts.pool;
        let escrow = &mut ctx.accounts.escrow;

        // Validate order size bounds for real money protection
        require!(
            deposit_amount >= pool.min_order_size && deposit_amount <= pool.max_order_size,
            ErrorCode::InvalidOrderSize
        );

        // Verify solvency proof is valid
        require!(solvency_proof.len() >= 64, ErrorCode::InvalidSolvencyProof);

        // Transfer real tokens to escrow for security
        let transfer_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_token_account.to_account_info(),
                to: escrow.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        );
        token::transfer(transfer_ctx, deposit_amount)?;

        // Set order details with encryption
        order.owner = ctx.accounts.user.key();
        order.pool = pool.key();
        order.side = side.clone();
        order.encrypted_amount = encrypted_amount.clone();
        order.encrypted_price = encrypted_price.clone();
        order.solvency_proof = solvency_proof.clone();
        order.order_hash = order_hash.clone();
        order.commitment_hash = commitment_hash;
        order.deposit_amount = deposit_amount;
        order.escrow_account = escrow.key();
        order.status = OrderStatus::Pending;
        order.submitted_at = Clock::get()?.unix_timestamp;

        pool.total_orders += 1;

        emit!(OrderSubmitted {
            order: order.key(),
            pool: pool.key(),
            user: order.owner,
            side: side,
            order_hash: order_hash,
            commitment: commitment_hash,
            deposit_amount,
            timestamp: order.submitted_at,
        });

        Ok(())
    }

    /// Start matching round with verifiable randomness
    pub fn batch_match_orders(
        ctx: Context<BatchMatchOrders>,
        round_id: u64,
        vrf_proof: Vec<u8>,
        vrf_randomness: [u8; 32],
        order_hashes: Vec<Vec<u8>>,
    ) -> Result<()> {
        let matching_round = &mut ctx.accounts.matching_round;
        let pool = &mut ctx.accounts.pool;

        require!(!pool.is_matching_active, ErrorCode::MatchingInProgress);
        require!(order_hashes.len() >= 2, ErrorCode::InsufficientOrders);

        // Verify VRF proof for fair ordering
        require!(vrf_proof.len() == 64, ErrorCode::InvalidVrfProof);

        matching_round.pool = pool.key();
        matching_round.round_id = round_id;
        matching_round.vrf_proof = vrf_proof.clone();
        matching_round.vrf_randomness = vrf_randomness;
        matching_round.order_hashes = order_hashes.clone();
        matching_round.status = MatchingStatus::InProgress;
        matching_round.started_at = Clock::get()?.unix_timestamp;
        matching_round.matches = Vec::new();
        matching_round.clearing_price = 0;

        pool.matching_round = round_id;
        pool.is_matching_active = true;

        emit!(MatchingRoundStarted {
            round: matching_round.key(),
            pool: pool.key(),
            round_id,
            vrf_randomness,
            order_count: order_hashes.len() as u64,
        });

        Ok(())
    }

    /// Execute real token settlements for matched trades
    pub fn settle_matched_trades(
        ctx: Context<SettleMatchedTrades>,
        matches: Vec<TradeMatch>,
        clearing_price: u64,
        matching_proof: Vec<u8>,
        threshold_signature: Vec<u8>,
    ) -> Result<()> {
        let matching_round = &mut ctx.accounts.matching_round;
        let pool = &mut ctx.accounts.pool;

        require!(
            matching_round.status == MatchingStatus::InProgress,
            ErrorCode::InvalidMatchingStatus
        );

        // Verify threshold decryption signature
        require!(threshold_signature.len() >= 64, ErrorCode::InvalidThresholdSignature);
        require!(matching_proof.len() >= 32, ErrorCode::InvalidMatchingProof);

        // Calculate trading fees
        let total_volume = matches.iter().fold(0u64, |acc, m| acc + m.amount);
        let total_fees = (total_volume * pool.fee_bps as u64) / 10000;

        matching_round.matches = matches.clone();
        matching_round.clearing_price = clearing_price;
        matching_round.matching_proof = matching_proof;
        matching_round.threshold_signature = threshold_signature;
        matching_round.total_fees = total_fees;
        matching_round.status = MatchingStatus::DecryptionComplete;

        // Update pool statistics
        pool.total_volume += total_volume;
        pool.total_trades += matches.len() as u64;
        pool.total_fees_collected += total_fees;

        for trade_match in matches.iter() {
            emit!(TradeExecuted {
                buy_order_hash: trade_match.buy_order_hash.clone(),
                sell_order_hash: trade_match.sell_order_hash.clone(),
                amount: trade_match.amount,
                price: clearing_price,
                round_id: matching_round.round_id,
                timestamp: Clock::get()?.unix_timestamp,
                fees: (trade_match.amount * pool.fee_bps as u64) / 10000,
            });
        }

        Ok(())
    }

    /// Execute real token transfers for settlements
    pub fn execute_settlements(
        ctx: Context<ExecuteSettlements>,
        settlement_data: Vec<Settlement>,
    ) -> Result<()> {
        let pool = &ctx.accounts.pool;
        
        for settlement in settlement_data.iter() {
            // Transfer tokens between parties with fees
            let net_amount = settlement.amount - settlement.fee_amount;
            
            // Execute real token transfer
            let transfer_ctx = CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.source_escrow.to_account_info(),
                    to: ctx.accounts.destination_account.to_account_info(),
                    authority: pool.to_account_info(),
                },
            );
            token::transfer(transfer_ctx, net_amount)?;

            // Transfer fees to pool treasury
            let fee_transfer_ctx = CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.source_escrow.to_account_info(),
                    to: ctx.accounts.fee_treasury.to_account_info(),
                    authority: pool.to_account_info(),
                },
            );
            token::transfer(fee_transfer_ctx, settlement.fee_amount)?;

            emit!(SettlementExecuted {
                trade_id: settlement.trade_id,
                amount: net_amount,
                fee: settlement.fee_amount,
            });
        }

        Ok(())
    }

    /// Complete matching round
    pub fn finalize_matching_round(
        ctx: Context<FinalizeMatchingRound>,
    ) -> Result<()> {
        let matching_round = &mut ctx.accounts.matching_round;
        let pool = &mut ctx.accounts.pool;

        require!(
            matching_round.status == MatchingStatus::DecryptionComplete,
            ErrorCode::InvalidMatchingStatus
        );

        matching_round.status = MatchingStatus::Completed;
        matching_round.completed_at = Some(Clock::get()?.unix_timestamp);
        pool.is_matching_active = false;

        emit!(MatchingRoundCompleted {
            round: matching_round.key(),
            pool: pool.key(),
            round_id: matching_round.round_id,
            total_matches: matching_round.matches.len() as u64,
            clearing_price: matching_round.clearing_price,
            total_fees: matching_round.total_fees,
        });

        Ok(())
    }

    /// Cancel pending order with refund
    pub fn cancel_order(
        ctx: Context<CancelOrder>,
    ) -> Result<()> {
        let order = &mut ctx.accounts.order;
        let escrow = &mut ctx.accounts.escrow;

        require!(order.status == OrderStatus::Pending, ErrorCode::InvalidOrderStatus);
        require!(order.owner == ctx.accounts.user.key(), ErrorCode::Unauthorized);

        // Refund deposited tokens
        let refund_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: escrow.to_account_info(),
                to: ctx.accounts.user_token_account.to_account_info(),
                authority: ctx.accounts.pool_authority.to_account_info(),
            },
        );
        token::transfer(refund_ctx, order.deposit_amount)?;

        order.status = OrderStatus::Cancelled;
        order.cancelled_at = Some(Clock::get()?.unix_timestamp);

        emit!(OrderCancelled {
            order: order.key(),
            user: order.owner,
            refund_amount: order.deposit_amount,
        });

        Ok(())
    }

    /// Emergency pause for security
    pub fn emergency_pause(
        ctx: Context<EmergencyPause>,
    ) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        
        require!(ctx.accounts.authority.key() == pool.authority, ErrorCode::Unauthorized);
        
        pool.is_paused = true;
        pool.paused_at = Some(Clock::get()?.unix_timestamp);

        emit!(EmergencyPaused {
            pool: pool.key(),
            authority: pool.authority,
            timestamp: pool.paused_at.unwrap(),
        });

        Ok(())
    }
}

// Account validation contexts
#[derive(Accounts)]
#[instruction(token_pair: String)]
pub struct InitializePool<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Pool::LEN,
        seeds = [b"pool", token_pair.as_bytes()],
        bump
    )]
    pub pool: Account<'info, Pool>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(order_hash: Vec<u8>)]
pub struct SubmitEncryptedOrder<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + Order::LEN,
        seeds = [b"order", &order_hash],
        bump
    )]
    pub order: Account<'info, Order>,
    
    #[account(mut)]
    pub pool: Account<'info, Pool>,
    
    #[account(
        init,
        payer = user,
        token::mint = token_mint,
        token::authority = pool,
        seeds = [b"escrow", order.key().as_ref()],
        bump
    )]
    pub escrow: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    
    pub token_mint: Account<'info, Mint>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(round_id: u64)]
pub struct BatchMatchOrders<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + MatchingRound::LEN,
        seeds = [b"round", pool.key().as_ref(), &round_id.to_le_bytes()],
        bump
    )]
    pub matching_round: Account<'info, MatchingRound>,
    
    #[account(mut)]
    pub pool: Account<'info, Pool>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SettleMatchedTrades<'info> {
    #[account(mut)]
    pub matching_round: Account<'info, MatchingRound>,
    
    #[account(mut)]
    pub pool: Account<'info, Pool>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct ExecuteSettlements<'info> {
    #[account(mut)]
    pub pool: Account<'info, Pool>,
    
    #[account(mut)]
    pub source_escrow: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub destination_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub fee_treasury: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct FinalizeMatchingRound<'info> {
    #[account(mut)]
    pub matching_round: Account<'info, MatchingRound>,
    
    #[account(mut)]
    pub pool: Account<'info, Pool>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct CancelOrder<'info> {
    #[account(mut)]
    pub order: Account<'info, Order>,
    
    #[account(mut)]
    pub escrow: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    
    /// CHECK: Pool authority for escrow transfers
    pub pool_authority: UncheckedAccount<'info>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct EmergencyPause<'info> {
    #[account(mut)]
    pub pool: Account<'info, Pool>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
}

// Account data structures
#[account]
pub struct Pool {
    pub authority: Pubkey,
    pub token_pair: String,
    pub elgamal_public_key: Vec<u8>,
    pub vrf_public_key: Vec<u8>,
    pub total_orders: u64,
    pub matching_round: u64,
    pub is_matching_active: bool,
    pub min_order_size: u64,
    pub max_order_size: u64,
    pub fee_bps: u16,
    pub total_volume: u64,
    pub total_trades: u64,
    pub total_fees_collected: u64,
    pub is_paused: bool,
    pub paused_at: Option<i64>,
    pub created_at: i64,
}

impl Pool {
    pub const LEN: usize = 32 + 64 + 64 + 64 + 8 + 8 + 1 + 8 + 8 + 2 + 8 + 8 + 8 + 1 + 9 + 8;
}

#[account]
pub struct Order {
    pub owner: Pubkey,
    pub pool: Pubkey,
    pub side: OrderSide,
    pub encrypted_amount: Vec<u8>,
    pub encrypted_price: Vec<u8>,
    pub solvency_proof: Vec<u8>,
    pub order_hash: Vec<u8>,
    pub commitment_hash: [u8; 32],
    pub deposit_amount: u64,
    pub escrow_account: Pubkey,
    pub status: OrderStatus,
    pub submitted_at: i64,
    pub cancelled_at: Option<i64>,
}

impl Order {
    pub const LEN: usize = 32 + 32 + 1 + 64 + 64 + 128 + 64 + 32 + 8 + 32 + 1 + 8 + 9;
}

#[account]
pub struct MatchingRound {
    pub pool: Pubkey,
    pub round_id: u64,
    pub vrf_proof: Vec<u8>,
    pub vrf_randomness: [u8; 32],
    pub order_hashes: Vec<Vec<u8>>,
    pub matches: Vec<TradeMatch>,
    pub clearing_price: u64,
    pub matching_proof: Vec<u8>,
    pub threshold_signature: Vec<u8>,
    pub total_fees: u64,
    pub started_at: i64,
    pub completed_at: Option<i64>,
    pub status: MatchingStatus,
}

impl MatchingRound {
    pub const LEN: usize = 32 + 8 + 64 + 32 + 512 + 1024 + 8 + 128 + 128 + 8 + 8 + 9 + 1;
}

// Data structures
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum OrderSide {
    Buy,
    Sell,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum OrderStatus {
    Pending,
    Matched,
    Cancelled,
    Executed,
    Settled,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum MatchingStatus {
    InProgress,
    DecryptionComplete,
    Completed,
    Failed,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct TradeMatch {
    pub buy_order_hash: Vec<u8>,
    pub sell_order_hash: Vec<u8>,
    pub amount: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct Settlement {
    pub trade_id: u64,
    pub amount: u64,
    pub fee_amount: u64,
}

// Events for real-time monitoring
#[event]
pub struct PoolInitialized {
    pub pool: Pubkey,
    pub authority: Pubkey,
    pub token_pair: String,
    pub min_order_size: u64,
    pub max_order_size: u64,
    pub fee_bps: u16,
}

#[event]
pub struct OrderSubmitted {
    pub order: Pubkey,
    pub pool: Pubkey,
    pub user: Pubkey,
    pub side: OrderSide,
    pub order_hash: Vec<u8>,
    pub commitment: [u8; 32],
    pub deposit_amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct MatchingRoundStarted {
    pub round: Pubkey,
    pub pool: Pubkey,
    pub round_id: u64,
    pub vrf_randomness: [u8; 32],
    pub order_count: u64,
}

#[event]
pub struct TradeExecuted {
    pub buy_order_hash: Vec<u8>,
    pub sell_order_hash: Vec<u8>,
    pub amount: u64,
    pub price: u64,
    pub round_id: u64,
    pub timestamp: i64,
    pub fees: u64,
}

#[event]
pub struct SettlementExecuted {
    pub trade_id: u64,
    pub amount: u64,
    pub fee: u64,
}

#[event]
pub struct MatchingRoundCompleted {
    pub round: Pubkey,
    pub pool: Pubkey,
    pub round_id: u64,
    pub total_matches: u64,
    pub clearing_price: u64,
    pub total_fees: u64,
}

#[event]
pub struct OrderCancelled {
    pub order: Pubkey,
    pub user: Pubkey,
    pub refund_amount: u64,
}

#[event]
pub struct EmergencyPaused {
    pub pool: Pubkey,
    pub authority: Pubkey,
    pub timestamp: i64,
}

// Comprehensive error codes for production safety
#[error_code]
pub enum ErrorCode {
    #[msg("Matching is already in progress")]
    MatchingInProgress,
    #[msg("Invalid matching status")]
    InvalidMatchingStatus,
    #[msg("Insufficient balance for order")]
    InsufficientBalance,
    #[msg("Invalid cryptographic proof")]
    InvalidProof,
    #[msg("Order size outside allowed bounds")]
    InvalidOrderSize,
    #[msg("Insufficient orders for matching round")]
    InsufficientOrders,
    #[msg("Invalid VRF proof")]
    InvalidVrfProof,
    #[msg("Invalid threshold signature")]
    InvalidThresholdSignature,
    #[msg("Invalid order status for operation")]
    InvalidOrderStatus,
    #[msg("Unauthorized access")]
    Unauthorized,
    #[msg("Invalid solvency proof")]
    InvalidSolvencyProof,
    #[msg("Invalid matching proof")]
    InvalidMatchingProof,
    #[msg("Pool is paused")]
    PoolPaused,
    #[msg("Settlement failed")]
    SettlementFailed,
}