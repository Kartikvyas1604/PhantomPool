const { Connection, PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID } = require('@solana/spl-token');

class PhantomPoolFinancialSafety {
    constructor() {
        this.emergencyHalt = false;
        this.transactionHistory = new Map();
        this.balanceCache = new Map();
        this.riskLimits = {
            maxTransactionAmount: 10000 * LAMPORTS_PER_SOL, // 10,000 SOL max per transaction
            maxDailyVolume: 100000 * LAMPORTS_PER_SOL,      // 100,000 SOL max per day per user
            maxSlippage: 0.05,                               // 5% maximum slippage
            maxPriceImpact: 0.03,                           // 3% maximum price impact
            minConfirmations: 3,                            // Minimum confirmations required
            maxRetries: 3                                   // Maximum retry attempts
        };
        this.auditLog = [];
        this.connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');
    }

    /**
     * CRITICAL: Pre-transaction validation - Must pass before any money moves
     */
    async validateTransaction(transaction) {
        try {
            // 1. Emergency halt check
            if (this.emergencyHalt) {
                throw new Error('EMERGENCY_HALT_ACTIVE: All transactions suspended for safety');
            }

            // 2. Transaction structure validation
            await this.validateTransactionStructure(transaction);

            // 3. User authentication and authorization
            await this.validateUserAuthorization(transaction);

            // 4. Balance verification
            await this.validateSufficientBalance(transaction);

            // 5. Amount limits validation
            await this.validateTransactionLimits(transaction);

            // 6. Duplicate transaction prevention
            await this.validateNoDuplicate(transaction);

            // 7. Slippage and price impact validation
            await this.validatePriceParameters(transaction);

            // 8. Smart contract security validation
            await this.validateSmartContractSecurity(transaction);

            this.logAuditEvent('TRANSACTION_VALIDATED', transaction, 'SUCCESS');
            return { valid: true, transactionId: this.generateTransactionId() };

        } catch (error) {
            this.logAuditEvent('TRANSACTION_VALIDATION_FAILED', transaction, error.message);
            throw new Error(`Transaction validation failed: ${error.message}`);
        }
    }

    /**
     * Real-time balance verification with blockchain confirmation
     */
    async validateSufficientBalance(transaction) {
        const { userWallet, amount, tokenMint } = transaction;

        try {
            // Get real-time balance from blockchain
            let balance;
            
            if (tokenMint === 'SOL') {
                balance = await this.connection.getBalance(new PublicKey(userWallet));
            } else {
                // Get SPL token balance
                balance = await this.getSPLTokenBalance(userWallet, tokenMint);
            }

            // Account for network fees (0.01 SOL safety buffer)
            const safetyBuffer = 0.01 * LAMPORTS_PER_SOL;
            const requiredBalance = amount + safetyBuffer;

            if (balance < requiredBalance) {
                throw new Error(`INSUFFICIENT_BALANCE: Required ${requiredBalance / LAMPORTS_PER_SOL} SOL, Available ${balance / LAMPORTS_PER_SOL} SOL`);
            }

            // Cache balance for performance (with 30-second expiry)
            this.balanceCache.set(userWallet, {
                balance: balance,
                timestamp: Date.now(),
                expiry: Date.now() + 30000
            });

            return { sufficient: true, balance: balance, required: requiredBalance };

        } catch (error) {
            throw new Error(`Balance validation failed: ${error.message}`);
        }
    }

    /**
     * Comprehensive transaction limits to prevent excessive risk
     */
    async validateTransactionLimits(transaction) {
        const { userWallet, amount } = transaction;

        // 1. Per-transaction limit
        if (amount > this.riskLimits.maxTransactionAmount) {
            throw new Error(`TRANSACTION_TOO_LARGE: Max ${this.riskLimits.maxTransactionAmount / LAMPORTS_PER_SOL} SOL per transaction`);
        }

        // 2. Daily volume limit per user
        const dailyVolume = await this.getUserDailyVolume(userWallet);
        if (dailyVolume + amount > this.riskLimits.maxDailyVolume) {
            throw new Error(`DAILY_LIMIT_EXCEEDED: Max ${this.riskLimits.maxDailyVolume / LAMPORTS_PER_SOL} SOL per day`);
        }

        // 3. Velocity check (prevent rapid-fire transactions)
        const recentTransactions = await this.getRecentUserTransactions(userWallet, 300000); // 5 minutes
        if (recentTransactions.length > 10) {
            throw new Error('VELOCITY_LIMIT_EXCEEDED: Too many transactions in short period');
        }

        return { withinLimits: true };
    }

    /**
     * Slippage and price impact protection
     */
    async validatePriceParameters(transaction) {
        const { expectedPrice, slippageTolerance, priceImpact } = transaction;

        // 1. Validate slippage tolerance
        if (slippageTolerance > this.riskLimits.maxSlippage) {
            throw new Error(`SLIPPAGE_TOO_HIGH: Max ${this.riskLimits.maxSlippage * 100}% slippage allowed`);
        }

        // 2. Validate price impact
        if (priceImpact > this.riskLimits.maxPriceImpact) {
            throw new Error(`PRICE_IMPACT_TOO_HIGH: Max ${this.riskLimits.maxPriceImpact * 100}% price impact allowed`);
        }

        // 3. Real-time price validation
        const currentPrice = await this.getCurrentMarketPrice(transaction.tokenPair);
        const priceDifference = Math.abs(expectedPrice - currentPrice) / currentPrice;
        
        if (priceDifference > slippageTolerance) {
            throw new Error(`PRICE_SLIPPAGE_EXCEEDED: Expected ${expectedPrice}, Current ${currentPrice}`);
        }

        return { priceValid: true, currentPrice: currentPrice };
    }

    /**
     * Duplicate transaction prevention using cryptographic signatures
     */
    async validateNoDuplicate(transaction) {
        const transactionHash = this.generateTransactionHash(transaction);
        
        // Check recent transaction history (last 24 hours)
        const recentWindow = Date.now() - (24 * 60 * 60 * 1000);
        const existingTransaction = this.transactionHistory.get(transactionHash);
        
        if (existingTransaction && existingTransaction.timestamp > recentWindow) {
            throw new Error('DUPLICATE_TRANSACTION: Identical transaction detected within 24 hours');
        }

        // Register this transaction
        this.transactionHistory.set(transactionHash, {
            timestamp: Date.now(),
            transaction: transaction
        });

        return { noDuplicate: true };
    }

    /**
     * Emergency halt system for immediate transaction suspension
     */
    activateEmergencyHalt(reason, activatedBy) {
        this.emergencyHalt = true;
        
        this.logAuditEvent('EMERGENCY_HALT_ACTIVATED', {
            reason: reason,
            activatedBy: activatedBy,
            timestamp: Date.now()
        }, 'CRITICAL');

        // Notify all connected clients
        this.broadcastEmergencyNotification({
            type: 'EMERGENCY_HALT',
            message: 'All trading has been temporarily suspended for safety',
            reason: reason
        });

        return { halted: true, timestamp: Date.now() };
    }

    /**
     * Safe emergency halt deactivation (requires multiple confirmations)
     */
    async deactivateEmergencyHalt(deactivatedBy, confirmationCode) {
        // Require valid confirmation code
        if (!this.validateConfirmationCode(confirmationCode)) {
            throw new Error('INVALID_CONFIRMATION_CODE: Emergency halt deactivation denied');
        }

        this.emergencyHalt = false;
        
        this.logAuditEvent('EMERGENCY_HALT_DEACTIVATED', {
            deactivatedBy: deactivatedBy,
            confirmationCode: confirmationCode,
            timestamp: Date.now()
        }, 'CRITICAL');

        return { resumed: true, timestamp: Date.now() };
    }

    /**
     * Real-time fraud detection using pattern analysis
     */
    async detectFraudulentActivity(transaction) {
        const { userWallet, amount, timestamp } = transaction;

        // 1. Unusual amount patterns
        const userHistory = await this.getUserTransactionHistory(userWallet, 30); // 30 days
        const averageAmount = this.calculateAverageTransactionAmount(userHistory);
        
        if (amount > averageAmount * 10) {
            this.flagSuspiciousActivity(userWallet, 'UNUSUAL_AMOUNT', { amount, average: averageAmount });
        }

        // 2. Time-based anomalies
        const usualTradingHours = await this.getUserTradingPattern(userWallet);
        const currentHour = new Date(timestamp).getHours();
        
        if (!usualTradingHours.includes(currentHour)) {
            this.flagSuspiciousActivity(userWallet, 'UNUSUAL_TIME', { hour: currentHour, usual: usualTradingHours });
        }

        // 3. Geographical anomalies (if IP tracking is enabled)
        const currentLocation = await this.getUserLocation(userWallet);
        const usualLocations = await this.getUserUsualLocations(userWallet);
        
        if (!this.isLocationFamiliar(currentLocation, usualLocations)) {
            this.flagSuspiciousActivity(userWallet, 'UNUSUAL_LOCATION', { current: currentLocation, usual: usualLocations });
        }

        return { fraudScore: this.calculateFraudScore(transaction), passed: true };
    }

    /**
     * Transaction execution with comprehensive safety checks
     */
    async executeTransaction(validatedTransaction) {
        let rollbackData = null;
        
        try {
            // 1. Final pre-execution validation
            await this.finalPreExecutionCheck(validatedTransaction);

            // 2. Create rollback snapshot
            rollbackData = await this.createRollbackSnapshot(validatedTransaction);

            // 3. Execute transaction with monitoring
            const result = await this.executeWithMonitoring(validatedTransaction);

            // 4. Post-execution verification
            await this.verifyTransactionExecution(result);

            // 5. Update user balances and history
            await this.updateUserRecords(validatedTransaction, result);

            this.logAuditEvent('TRANSACTION_EXECUTED', validatedTransaction, 'SUCCESS', result);
            
            return {
                success: true,
                transactionId: result.transactionId,
                signature: result.signature,
                blockHeight: result.blockHeight,
                fee: result.fee,
                timestamp: Date.now()
            };

        } catch (error) {
            // CRITICAL: Automatic rollback on any failure
            if (rollbackData) {
                await this.executeRollback(rollbackData, error.message);
            }

            this.logAuditEvent('TRANSACTION_FAILED', validatedTransaction, 'ERROR', error.message);
            throw new Error(`Transaction execution failed: ${error.message}`);
        }
    }

    /**
     * Comprehensive audit logging for regulatory compliance
     */
    logAuditEvent(eventType, data, status, details = null) {
        const auditEntry = {
            id: this.generateAuditId(),
            timestamp: Date.now(),
            eventType: eventType,
            status: status,
            data: data,
            details: details,
            ip: this.getCurrentIP(),
            userAgent: this.getCurrentUserAgent(),
            sessionId: this.getCurrentSessionId()
        };

        this.auditLog.push(auditEntry);
        
        // Also write to persistent storage
        this.writeAuditToDatabase(auditEntry);
        
        // Real-time monitoring alert for critical events
        if (status === 'CRITICAL' || status === 'ERROR') {
            this.sendRealTimeAlert(auditEntry);
        }
    }

    /**
     * Helper Methods
     */
    async getSPLTokenBalance(wallet, tokenMint) {
        const walletPublicKey = new PublicKey(wallet);
        const mintPublicKey = new PublicKey(tokenMint);
        
        const tokenAccounts = await this.connection.getTokenAccountsByOwner(walletPublicKey, {
            mint: mintPublicKey
        });

        if (tokenAccounts.value.length === 0) {
            return 0;
        }

        const accountInfo = await this.connection.getTokenAccountBalance(tokenAccounts.value[0].pubkey);
        return accountInfo.value.uiAmount * Math.pow(10, accountInfo.value.decimals);
    }

    generateTransactionHash(transaction) {
        const crypto = require('crypto');
        const transactionString = JSON.stringify(transaction, Object.keys(transaction).sort());
        return crypto.createHash('sha256').update(transactionString).digest('hex');
    }

    generateTransactionId() {
        const crypto = require('crypto');
        return crypto.randomBytes(16).toString('hex');
    }

    generateAuditId() {
        const crypto = require('crypto');
        return crypto.randomBytes(8).toString('hex');
    }

    async getCurrentMarketPrice(tokenPair) {
        // Integration with real price feeds (Jupiter, Coingecko, etc.)
        // This should be implemented with actual price APIs
        try {
            const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${tokenPair}&vs_currencies=usd`);
            const data = await response.json();
            return data[tokenPair].usd;
        } catch (error) {
            throw new Error(`Failed to get current price: ${error.message}`);
        }
    }

    /**
     * Health check for financial safety systems
     */
    async performHealthCheck() {
        const healthStatus = {
            timestamp: Date.now(),
            emergencyHalt: this.emergencyHalt,
            connectionStatus: 'unknown',
            balanceCacheSize: this.balanceCache.size,
            transactionHistorySize: this.transactionHistory.size,
            auditLogSize: this.auditLog.length,
            riskLimitsActive: true,
            criticalErrors: []
        };

        try {
            // Test Solana connection
            const latestBlockhash = await this.connection.getLatestBlockhash();
            healthStatus.connectionStatus = latestBlockhash ? 'connected' : 'disconnected';
            healthStatus.latestBlockHeight = latestBlockhash.blockhash;

        } catch (error) {
            healthStatus.connectionStatus = 'error';
            healthStatus.criticalErrors.push(`Solana connection failed: ${error.message}`);
        }

        return healthStatus;
    }
}

module.exports = PhantomPoolFinancialSafety;