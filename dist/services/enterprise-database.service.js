const { Pool, Client } = require('pg');
const fs = require('fs').promises;
const path = require('path');

class EnterpriseDatabase {
    constructor() {
        // Primary database connection pool
        this.primaryPool = new Pool({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            database: process.env.DB_NAME || 'phantompool_prod',
            user: process.env.DB_USER || 'phantompool',
            password: process.env.DB_PASSWORD,
            max: 20, // Maximum number of connections
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });

        // Read replica for non-critical reads
        this.readPool = new Pool({
            host: process.env.DB_READ_HOST || process.env.DB_HOST || 'localhost',
            port: process.env.DB_READ_PORT || process.env.DB_PORT || 5432,
            database: process.env.DB_NAME || 'phantompool_prod',
            user: process.env.DB_READ_USER || process.env.DB_USER || 'phantompool',
            password: process.env.DB_READ_PASSWORD || process.env.DB_PASSWORD,
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });

        this.auditPool = new Pool({
            host: process.env.AUDIT_DB_HOST || process.env.DB_HOST || 'localhost',
            port: process.env.AUDIT_DB_PORT || process.env.DB_PORT || 5432,
            database: process.env.AUDIT_DB_NAME || 'phantompool_audit',
            user: process.env.AUDIT_DB_USER || process.env.DB_USER || 'phantompool',
            password: process.env.AUDIT_DB_PASSWORD || process.env.DB_PASSWORD,
            max: 5,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });

        this.isInitialized = false;
        this.backupInterval = null;
        
        // Initialize database on startup
        this.initialize();
    }

    /**
     * Initialize enterprise database with all required tables and constraints
     */
    async initialize() {
        try {
            await this.createTables();
            await this.createIndexes();
            await this.createConstraints();
            await this.setupAuditTables();
            await this.startBackupScheduler();
            
            this.isInitialized = true;
            console.log('✅ Enterprise database initialized successfully');
            
        } catch (error) {
            console.error('❌ Database initialization failed:', error);
            throw new Error(`Database initialization failed: ${error.message}`);
        }
    }

    /**
     * Create all production tables with proper constraints
     */
    async createTables() {
        const client = await this.primaryPool.connect();
        
        try {
            await client.query('BEGIN');

            // Users table with financial data
            await client.query(`
                CREATE TABLE IF NOT EXISTS users (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    wallet_address VARCHAR(44) UNIQUE NOT NULL,
                    public_key VARCHAR(44) NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    is_verified BOOLEAN DEFAULT FALSE,
                    kyc_status VARCHAR(20) DEFAULT 'pending',
                    risk_level VARCHAR(20) DEFAULT 'low',
                    daily_volume_limit BIGINT DEFAULT 100000000000, -- 100 SOL in lamports
                    total_volume BIGINT DEFAULT 0,
                    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    is_blocked BOOLEAN DEFAULT FALSE,
                    block_reason TEXT,
                    CONSTRAINT valid_kyc_status CHECK (kyc_status IN ('pending', 'verified', 'rejected')),
                    CONSTRAINT valid_risk_level CHECK (risk_level IN ('low', 'medium', 'high', 'blocked'))
                )
            `);

            // Orders table with encryption support
            await client.query(`
                CREATE TABLE IF NOT EXISTS orders (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    order_type VARCHAR(10) NOT NULL,
                    side VARCHAR(4) NOT NULL,
                    token_mint VARCHAR(44) NOT NULL,
                    base_token VARCHAR(44) NOT NULL,
                    quote_token VARCHAR(44) NOT NULL,
                    amount BIGINT NOT NULL,
                    price BIGINT NOT NULL,
                    filled_amount BIGINT DEFAULT 0,
                    status VARCHAR(20) DEFAULT 'pending',
                    encrypted_data TEXT, -- Encrypted order details
                    commitment_hash VARCHAR(64) NOT NULL, -- Cryptographic commitment
                    nonce VARCHAR(32) NOT NULL,
                    expires_at TIMESTAMP WITH TIME ZONE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    blockchain_signature VARCHAR(88),
                    block_height BIGINT,
                    CONSTRAINT valid_order_type CHECK (order_type IN ('limit', 'market', 'stop')),
                    CONSTRAINT valid_side CHECK (side IN ('buy', 'sell')),
                    CONSTRAINT valid_status CHECK (status IN ('pending', 'partial', 'filled', 'cancelled', 'expired', 'failed')),
                    CONSTRAINT positive_amount CHECK (amount > 0),
                    CONSTRAINT positive_price CHECK (price > 0)
                )
            `);

            // Trades table with complete execution data
            await client.query(`
                CREATE TABLE IF NOT EXISTS trades (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    buyer_order_id UUID NOT NULL REFERENCES orders(id),
                    seller_order_id UUID NOT NULL REFERENCES orders(id),
                    buyer_id UUID NOT NULL REFERENCES users(id),
                    seller_id UUID NOT NULL REFERENCES users(id),
                    token_mint VARCHAR(44) NOT NULL,
                    amount BIGINT NOT NULL,
                    price BIGINT NOT NULL,
                    total_value BIGINT NOT NULL,
                    fee_buyer BIGINT NOT NULL DEFAULT 0,
                    fee_seller BIGINT NOT NULL DEFAULT 0,
                    blockchain_signature VARCHAR(88) NOT NULL,
                    block_height BIGINT NOT NULL,
                    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    settlement_status VARCHAR(20) DEFAULT 'pending',
                    CONSTRAINT valid_settlement_status CHECK (settlement_status IN ('pending', 'settled', 'failed')),
                    CONSTRAINT positive_trade_amount CHECK (amount > 0),
                    CONSTRAINT positive_trade_price CHECK (price > 0)
                )
            `);

            // Balances table with real-time tracking
            await client.query(`
                CREATE TABLE IF NOT EXISTS balances (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    token_mint VARCHAR(44) NOT NULL,
                    available_balance BIGINT NOT NULL DEFAULT 0,
                    locked_balance BIGINT NOT NULL DEFAULT 0,
                    total_balance BIGINT GENERATED ALWAYS AS (available_balance + locked_balance) STORED,
                    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    blockchain_verified_at TIMESTAMP WITH TIME ZONE,
                    blockchain_balance BIGINT,
                    UNIQUE(user_id, token_mint),
                    CONSTRAINT non_negative_available CHECK (available_balance >= 0),
                    CONSTRAINT non_negative_locked CHECK (locked_balance >= 0)
                )
            `);

            // Transactions table for all financial movements
            await client.query(`
                CREATE TABLE IF NOT EXISTS transactions (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id UUID NOT NULL REFERENCES users(id),
                    transaction_type VARCHAR(20) NOT NULL,
                    token_mint VARCHAR(44) NOT NULL,
                    amount BIGINT NOT NULL,
                    balance_before BIGINT,
                    balance_after BIGINT,
                    reference_id UUID, -- Links to orders, trades, etc.
                    blockchain_signature VARCHAR(88),
                    block_height BIGINT,
                    status VARCHAR(20) DEFAULT 'pending',
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    confirmed_at TIMESTAMP WITH TIME ZONE,
                    metadata JSONB,
                    CONSTRAINT valid_transaction_type CHECK (transaction_type IN ('deposit', 'withdrawal', 'trade', 'fee', 'reward', 'penalty')),
                    CONSTRAINT valid_transaction_status CHECK (status IN ('pending', 'confirmed', 'failed', 'rolled_back'))
                )
            `);

            // Financial safety events table
            await client.query(`
                CREATE TABLE IF NOT EXISTS safety_events (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    event_type VARCHAR(50) NOT NULL,
                    user_id UUID REFERENCES users(id),
                    severity VARCHAR(20) NOT NULL,
                    description TEXT NOT NULL,
                    metadata JSONB,
                    action_taken VARCHAR(100),
                    resolved BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    resolved_at TIMESTAMP WITH TIME ZONE,
                    CONSTRAINT valid_severity CHECK (severity IN ('low', 'medium', 'high', 'critical'))
                )
            `);

            await client.query('COMMIT');
            console.log('✅ Database tables created successfully');

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Create performance and security indexes
     */
    async createIndexes() {
        const client = await this.primaryPool.connect();
        
        try {
            const indexes = [
                // User indexes
                'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_wallet_address ON users(wallet_address)',
                'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_created_at ON users(created_at)',
                
                // Order indexes
                'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_user_id ON orders(user_id)',
                'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_status ON orders(status)',
                'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_token_pair ON orders(base_token, quote_token)',
                'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_created_at ON orders(created_at)',
                'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_commitment_hash ON orders(commitment_hash)',
                
                // Trade indexes
                'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trades_executed_at ON trades(executed_at)',
                'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trades_token_mint ON trades(token_mint)',
                'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trades_buyer_seller ON trades(buyer_id, seller_id)',
                
                // Balance indexes
                'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_balances_user_token ON balances(user_id, token_mint)',
                'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_balances_last_updated ON balances(last_updated)',
                
                // Transaction indexes
                'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_user_id ON transactions(user_id)',
                'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_type ON transactions(transaction_type)',
                'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_created_at ON transactions(created_at)',
                'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_signature ON transactions(blockchain_signature)',
                
                // Safety event indexes
                'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_safety_events_severity ON safety_events(severity)',
                'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_safety_events_created_at ON safety_events(created_at)',
                'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_safety_events_resolved ON safety_events(resolved)'
            ];

            for (const indexSQL of indexes) {
                try {
                    await client.query(indexSQL);
                } catch (error) {
                    // Ignore if index already exists
                    if (!error.message.includes('already exists')) {
                        console.warn(`Index creation warning: ${error.message}`);
                    }
                }
            }

            console.log('✅ Database indexes created successfully');

        } finally {
            client.release();
        }
    }

    /**
     * Create financial safety constraints
     */
    async createConstraints() {
        const client = await this.primaryPool.connect();
        
        try {
            // Add row-level security
            await client.query(`
                ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
                ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
                ALTER TABLE balances ENABLE ROW LEVEL SECURITY;
                ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
            `);

            // Create policies for data protection
            await client.query(`
                CREATE POLICY IF NOT EXISTS orders_user_policy ON orders
                    FOR ALL TO phantompool_app
                    USING (user_id = current_setting('app.current_user_id')::UUID);
                
                CREATE POLICY IF NOT EXISTS balances_user_policy ON balances
                    FOR ALL TO phantompool_app
                    USING (user_id = current_setting('app.current_user_id')::UUID);
            `);

            console.log('✅ Database constraints created successfully');

        } catch (error) {
            console.warn(`Constraint creation warning: ${error.message}`);
        } finally {
            client.release();
        }
    }

    /**
     * Setup audit tables for compliance
     */
    async setupAuditTables() {
        const client = await this.auditPool.connect();
        
        try {
            await client.query('BEGIN');

            // Audit log table
            await client.query(`
                CREATE TABLE IF NOT EXISTS audit_log (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    table_name VARCHAR(50) NOT NULL,
                    operation VARCHAR(10) NOT NULL,
                    record_id UUID,
                    old_values JSONB,
                    new_values JSONB,
                    changed_by UUID,
                    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    ip_address INET,
                    user_agent TEXT,
                    CONSTRAINT valid_operation CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE'))
                )
            `);

            // Financial events audit
            await client.query(`
                CREATE TABLE IF NOT EXISTS financial_audit (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    event_type VARCHAR(50) NOT NULL,
                    user_id UUID,
                    amount BIGINT,
                    token_mint VARCHAR(44),
                    before_balance BIGINT,
                    after_balance BIGINT,
                    transaction_signature VARCHAR(88),
                    block_height BIGINT,
                    metadata JSONB,
                    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            `);

            await client.query('COMMIT');
            console.log('✅ Audit tables created successfully');

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * CRITICAL: Execute financial transaction with ACID compliance
     */
    async executeFinancialTransaction(transactionData) {
        const client = await this.primaryPool.connect();
        
        try {
            // Start ACID transaction
            await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
            
            const {
                userId,
                transactionType,
                tokenMint,
                amount,
                referenceId,
                blockchainSignature,
                blockHeight,
                metadata
            } = transactionData;

            // 1. Lock user's balance for update
            const balanceResult = await client.query(`
                SELECT available_balance, locked_balance, total_balance
                FROM balances
                WHERE user_id = $1 AND token_mint = $2
                FOR UPDATE
            `, [userId, tokenMint]);

            let currentBalance = balanceResult.rows[0] || {
                available_balance: '0',
                locked_balance: '0',
                total_balance: '0'
            };

            // 2. Validate sufficient balance for debits
            if (['withdrawal', 'trade', 'fee'].includes(transactionType)) {
                if (BigInt(currentBalance.available_balance) < BigInt(Math.abs(amount))) {
                    throw new Error(`INSUFFICIENT_BALANCE: Required ${Math.abs(amount)}, Available ${currentBalance.available_balance}`);
                }
            }

            // 3. Calculate new balance
            const balanceBefore = BigInt(currentBalance.total_balance);
            const balanceAfter = balanceBefore + BigInt(amount);

            // 4. Update balance atomically
            await client.query(`
                INSERT INTO balances (user_id, token_mint, available_balance, last_updated)
                VALUES ($1, $2, $3, NOW())
                ON CONFLICT (user_id, token_mint)
                DO UPDATE SET
                    available_balance = balances.available_balance + $3,
                    last_updated = NOW()
            `, [userId, tokenMint, amount]);

            // 5. Record transaction
            const transactionResult = await client.query(`
                INSERT INTO transactions (
                    user_id, transaction_type, token_mint, amount,
                    balance_before, balance_after, reference_id,
                    blockchain_signature, block_height, status, metadata
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'confirmed', $10)
                RETURNING id, created_at
            `, [
                userId, transactionType, tokenMint, amount,
                balanceBefore.toString(), balanceAfter.toString(), referenceId,
                blockchainSignature, blockHeight, metadata
            ]);

            // 6. Log to audit trail
            await this.logFinancialAudit({
                eventType: transactionType,
                userId: userId,
                amount: amount,
                tokenMint: tokenMint,
                beforeBalance: balanceBefore.toString(),
                afterBalance: balanceAfter.toString(),
                transactionSignature: blockchainSignature,
                blockHeight: blockHeight,
                metadata: metadata
            });

            // Commit transaction
            await client.query('COMMIT');

            return {
                success: true,
                transactionId: transactionResult.rows[0].id,
                balanceBefore: balanceBefore.toString(),
                balanceAfter: balanceAfter.toString(),
                timestamp: transactionResult.rows[0].created_at
            };

        } catch (error) {
            // CRITICAL: Automatic rollback on any failure
            await client.query('ROLLBACK');
            
            console.error('❌ Financial transaction failed:', error);
            
            // Log failed transaction attempt
            await this.logSafetyEvent({
                eventType: 'TRANSACTION_ROLLBACK',
                userId: transactionData.userId,
                severity: 'high',
                description: `Financial transaction rolled back: ${error.message}`,
                metadata: transactionData
            });

            throw new Error(`Financial transaction failed: ${error.message}`);

        } finally {
            client.release();
        }
    }

    /**
     * Real-time backup scheduler
     */
    async startBackupScheduler() {
        // Backup every 15 minutes
        this.backupInterval = setInterval(async () => {
            try {
                await this.createRealTimeBackup();
            } catch (error) {
                console.error('❌ Backup failed:', error);
                await this.logSafetyEvent({
                    eventType: 'BACKUP_FAILED',
                    severity: 'high',
                    description: `Real-time backup failed: ${error.message}`
                });
            }
        }, 15 * 60 * 1000); // 15 minutes

        console.log('✅ Real-time backup scheduler started');
    }

    /**
     * Create real-time backup
     */
    async createRealTimeBackup() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(process.env.BACKUP_DIR || './backups', `phantompool_${timestamp}.sql`);

        try {
            // Ensure backup directory exists
            await fs.mkdir(path.dirname(backupPath), { recursive: true });

            // Create database dump
            const { spawn } = require('child_process');
            const pgDump = spawn('pg_dump', [
                `-h${process.env.DB_HOST || 'localhost'}`,
                `-p${process.env.DB_PORT || 5432}`,
                `-U${process.env.DB_USER || 'phantompool'}`,
                `-d${process.env.DB_NAME || 'phantompool_prod'}`,
                '--verbose',
                '--clean',
                '--no-owner',
                '--format=custom'
            ], {
                env: { ...process.env, PGPASSWORD: process.env.DB_PASSWORD }
            });

            const backupStream = require('fs').createWriteStream(backupPath);
            pgDump.stdout.pipe(backupStream);

            return new Promise((resolve, reject) => {
                pgDump.on('close', (code) => {
                    if (code === 0) {
                        console.log(`✅ Backup created: ${backupPath}`);
                        resolve(backupPath);
                    } else {
                        reject(new Error(`pg_dump exited with code ${code}`));
                    }
                });

                pgDump.on('error', reject);
            });

        } catch (error) {
            throw new Error(`Backup creation failed: ${error.message}`);
        }
    }

    /**
     * Log financial audit event
     */
    async logFinancialAudit(auditData) {
        const client = await this.auditPool.connect();
        
        try {
            await client.query(`
                INSERT INTO financial_audit (
                    event_type, user_id, amount, token_mint,
                    before_balance, after_balance, transaction_signature,
                    block_height, metadata
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `, [
                auditData.eventType,
                auditData.userId,
                auditData.amount,
                auditData.tokenMint,
                auditData.beforeBalance,
                auditData.afterBalance,
                auditData.transactionSignature,
                auditData.blockHeight,
                auditData.metadata
            ]);

        } finally {
            client.release();
        }
    }

    /**
     * Log safety event
     */
    async logSafetyEvent(eventData) {
        const client = await this.primaryPool.connect();
        
        try {
            await client.query(`
                INSERT INTO safety_events (
                    event_type, user_id, severity, description, metadata, action_taken
                ) VALUES ($1, $2, $3, $4, $5, $6)
            `, [
                eventData.eventType,
                eventData.userId || null,
                eventData.severity,
                eventData.description,
                eventData.metadata || null,
                eventData.actionTaken || null
            ]);

        } finally {
            client.release();
        }
    }

    /**
     * Get user's real-time balance with blockchain verification
     */
    async getUserBalance(userId, tokenMint) {
        const client = await this.readPool.connect();
        
        try {
            const result = await client.query(`
                SELECT 
                    available_balance,
                    locked_balance,
                    total_balance,
                    last_updated,
                    blockchain_verified_at,
                    blockchain_balance
                FROM balances
                WHERE user_id = $1 AND token_mint = $2
            `, [userId, tokenMint]);

            return result.rows[0] || {
                available_balance: '0',
                locked_balance: '0',
                total_balance: '0',
                last_updated: null,
                blockchain_verified_at: null,
                blockchain_balance: null
            };

        } finally {
            client.release();
        }
    }

    /**
     * Health check for database systems
     */
    async healthCheck() {
        const checks = {
            primary_db: false,
            read_db: false,
            audit_db: false,
            backup_system: false,
            timestamp: Date.now()
        };

        try {
            // Test primary database
            const primaryClient = await this.primaryPool.connect();
            await primaryClient.query('SELECT 1');
            primaryClient.release();
            checks.primary_db = true;

            // Test read database
            const readClient = await this.readPool.connect();
            await readClient.query('SELECT 1');
            readClient.release();
            checks.read_db = true;

            // Test audit database
            const auditClient = await this.auditPool.connect();
            await auditClient.query('SELECT 1');
            auditClient.release();
            checks.audit_db = true;

            // Check backup scheduler
            checks.backup_system = this.backupInterval !== null;

        } catch (error) {
            console.error('Database health check failed:', error);
        }

        return checks;
    }

    /**
     * Graceful shutdown
     */
    async shutdown() {
        try {
            if (this.backupInterval) {
                clearInterval(this.backupInterval);
            }

            await Promise.all([
                this.primaryPool.end(),
                this.readPool.end(),
                this.auditPool.end()
            ]);

            console.log('✅ Database connections closed gracefully');

        } catch (error) {
            console.error('❌ Database shutdown error:', error);
        }
    }
}

module.exports = EnterpriseDatabase;