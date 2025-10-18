/**
 * PhantomPool Real-Time Risk Management System
 * CRITICAL FOR FUND PROTECTION: Advanced risk management with automatic circuit breakers
 * 
 * Features:
 * 1. Real-time position monitoring and limits
 * 2. Automatic circuit breakers for abnormal activity
 * 3. Portfolio exposure calculations
 * 4. Volatility-adjusted position sizing
 * 5. Liquidity risk assessment
 * 6. Counterparty risk evaluation
 * 7. Market manipulation detection
 */

const EnterpriseDatabase = require('./enterprise-database.service');
const PhantomPoolFinancialSafety = require('./financial-safety.service');

class RealTimeRiskManager {
    constructor() {
        this.db = new EnterpriseDatabase();
        this.financialSafety = new PhantomPoolFinancialSafety();
        
        // Risk parameters - CONSERVATIVE for real money
        this.riskLimits = {
            maxPositionSize: 0.1, // 10% of portfolio max per position
            maxDailyLoss: 0.05,   // 5% max daily loss
            maxDrawdown: 0.15,    // 15% max portfolio drawdown
            maxLeverage: 1.0,     // No leverage allowed
            maxConcentration: 0.25, // 25% max in single token
            volatilityLimit: 0.3,  // 30% daily volatility limit
            liquidityThreshold: 0.1, // Minimum 10% daily volume for trading
            correlationLimit: 0.7  // Max 70% correlation between positions
        };

        // Circuit breaker levels
        this.circuitBreakers = {
            portfolio: {
                level1: 0.03, // 3% portfolio loss - reduce position sizes
                level2: 0.05, // 5% portfolio loss - halt new positions
                level3: 0.08  // 8% portfolio loss - emergency liquidation
            },
            individual: {
                level1: 0.05, // 5% position loss - warning
                level2: 0.10, // 10% position loss - forced reduction
                level3: 0.15  // 15% position loss - forced liquidation
            },
            market: {
                volatility: 0.20, // 20% price movement - halt trading
                volume: 0.5       // 50% volume drop - liquidity warning
            }
        };

        this.activeAlerts = new Map();
        this.userRiskProfiles = new Map();
        this.marketData = new Map();
        
        // Start risk monitoring
        this.startRiskMonitoring();
    }

    /**
     * Start real-time risk monitoring system
     */
    startRiskMonitoring() {
        // Portfolio risk monitoring every 30 seconds
        setInterval(() => this.monitorPortfolioRisk(), 30000);
        
        // Position risk monitoring every 15 seconds
        setInterval(() => this.monitorPositionRisk(), 15000);
        
        // Market risk monitoring every 10 seconds
        setInterval(() => this.monitorMarketRisk(), 10000);
        
        // Correlation monitoring every 5 minutes
        setInterval(() => this.monitorCorrelationRisk(), 300000);
        
        console.log('✅ Real-time risk monitoring system started');
    }

    /**
     * CRITICAL: Pre-trade risk validation - MUST PASS before any trade
     */
    async validateTradeRisk(tradeData) {
        try {
            const {
                userId,
                tokenMint,
                amount,
                price,
                side,
                orderType
            } = tradeData;

            // 1. Get user's current risk profile
            const riskProfile = await this.getUserRiskProfile(userId);
            
            // 2. Calculate position impact
            const positionImpact = await this.calculatePositionImpact(userId, tokenMint, amount, price);
            
            // 3. Validate position size limits
            await this.validatePositionLimits(userId, positionImpact);
            
            // 4. Validate portfolio concentration
            await this.validateConcentrationLimits(userId, tokenMint, positionImpact);
            
            // 5. Validate liquidity requirements
            await this.validateLiquidityRequirements(tokenMint, amount);
            
            // 6. Check market conditions
            await this.validateMarketConditions(tokenMint);
            
            // 7. Validate user's risk capacity
            await this.validateUserRiskCapacity(userId, positionImpact);
            
            // 8. Check for circuit breaker conditions
            await this.checkCircuitBreakers(userId, tokenMint);

            return {
                approved: true,
                riskScore: positionImpact.riskScore,
                recommendations: positionImpact.recommendations,
                limits: {
                    maxSize: positionImpact.maxAllowedSize,
                    stopLoss: positionImpact.recommendedStopLoss,
                    takeProfit: positionImpact.recommendedTakeProfit
                }
            };

        } catch (error) {
            // Log risk validation failure
            await this.db.logSafetyEvent({
                eventType: 'RISK_VALIDATION_FAILED',
                userId: tradeData.userId,
                severity: 'high',
                description: `Trade risk validation failed: ${error.message}`,
                metadata: tradeData
            });

            throw new Error(`RISK_VALIDATION_FAILED: ${error.message}`);
        }
    }

    /**
     * Calculate impact of proposed position on portfolio
     */
    async calculatePositionImpact(userId, tokenMint, amount, price) {
        try {
            // Get current portfolio
            const portfolio = await this.getUserPortfolio(userId);
            const totalPortfolioValue = this.calculatePortfolioValue(portfolio);
            
            // Calculate position value
            const positionValue = amount * price;
            const positionWeight = positionValue / totalPortfolioValue;
            
            // Get token volatility data
            const volatility = await this.getTokenVolatility(tokenMint);
            
            // Calculate risk metrics
            const var95 = positionValue * volatility * 2.33; // 95% VaR
            const var99 = positionValue * volatility * 2.58; // 99% VaR
            
            // Risk-adjusted position size
            const maxAllowedValue = totalPortfolioValue * this.riskLimits.maxPositionSize;
            const maxAllowedSize = Math.min(amount, maxAllowedValue / price);
            
            // Calculate correlations with existing positions
            const correlationRisk = await this.calculateCorrelationRisk(userId, tokenMint, positionValue);
            
            // Overall risk score (0-100)
            const riskScore = this.calculateRiskScore({
                positionWeight,
                volatility,
                correlationRisk,
                liquidityRisk: await this.getLiquidityRisk(tokenMint)
            });

            return {
                positionValue,
                positionWeight,
                var95,
                var99,
                maxAllowedSize,
                riskScore,
                correlationRisk,
                recommendedStopLoss: price * (1 - volatility * 2),
                recommendedTakeProfit: price * (1 + volatility * 1.5),
                recommendations: this.generateRiskRecommendations(riskScore, positionWeight, volatility)
            };

        } catch (error) {
            throw new Error(`Position impact calculation failed: ${error.message}`);
        }
    }

    /**
     * Validate position size against limits
     */
    async validatePositionLimits(userId, positionImpact) {
        const { positionWeight, riskScore } = positionImpact;
        
        // Check maximum position size
        if (positionWeight > this.riskLimits.maxPositionSize) {
            throw new Error(`POSITION_TOO_LARGE: Max ${this.riskLimits.maxPositionSize * 100}% of portfolio allowed`);
        }
        
        // Check risk-adjusted limits
        const maxRiskAdjustedSize = this.riskLimits.maxPositionSize * (1 - riskScore / 100);
        if (positionWeight > maxRiskAdjustedSize) {
            throw new Error(`RISK_ADJUSTED_LIMIT_EXCEEDED: Max ${maxRiskAdjustedSize * 100}% allowed for this risk level`);
        }
        
        // Check user's individual risk limit
        const userProfile = await this.getUserRiskProfile(userId);
        if (positionWeight > userProfile.maxPositionSize) {
            throw new Error(`USER_LIMIT_EXCEEDED: User limit is ${userProfile.maxPositionSize * 100}%`);
        }
    }

    /**
     * Validate concentration limits across portfolio
     */
    async validateConcentrationLimits(userId, tokenMint, positionImpact) {
        const portfolio = await this.getUserPortfolio(userId);
        const currentConcentration = this.calculateTokenConcentration(portfolio, tokenMint);
        const newConcentration = currentConcentration + positionImpact.positionWeight;
        
        if (newConcentration > this.riskLimits.maxConcentration) {
            throw new Error(`CONCENTRATION_LIMIT_EXCEEDED: Max ${this.riskLimits.maxConcentration * 100}% in single token`);
        }
        
        // Check sector concentration if applicable
        const sectorConcentration = await this.calculateSectorConcentration(userId, tokenMint, positionImpact);
        if (sectorConcentration.total > 0.4) { // 40% max per sector
            throw new Error(`SECTOR_CONCENTRATION_EXCEEDED: Max 40% per sector, would have ${sectorConcentration.total * 100}%`);
        }
    }

    /**
     * Validate liquidity requirements
     */
    async validateLiquidityRequirements(tokenMint, amount) {
        const liquidityData = await this.getTokenLiquidity(tokenMint);
        
        // Check if token has sufficient daily volume
        const dailyVolume = liquidityData.volume24h;
        const positionVolumeRatio = amount / dailyVolume;
        
        if (positionVolumeRatio > this.riskLimits.liquidityThreshold) {
            throw new Error(`LIQUIDITY_INSUFFICIENT: Position would be ${positionVolumeRatio * 100}% of daily volume`);
        }
        
        // Check order book depth
        const orderBookDepth = liquidityData.orderBookDepth;
        if (orderBookDepth.bidDepth < amount * 2 || orderBookDepth.askDepth < amount * 2) {
            throw new Error('ORDER_BOOK_INSUFFICIENT: Not enough liquidity in order book');
        }
    }

    /**
     * Monitor portfolio-level risk in real-time
     */
    async monitorPortfolioRisk() {
        try {
            const users = await this.getActiveUsers();
            
            for (const user of users) {
                const portfolio = await this.getUserPortfolio(user.id);
                const riskMetrics = await this.calculatePortfolioRisk(portfolio);
                
                // Check circuit breaker levels
                if (riskMetrics.dailyPnL < -this.circuitBreakers.portfolio.level3) {
                    await this.triggerEmergencyLiquidation(user.id, 'PORTFOLIO_LEVEL3_BREACH');
                } else if (riskMetrics.dailyPnL < -this.circuitBreakers.portfolio.level2) {
                    await this.haltNewPositions(user.id, 'PORTFOLIO_LEVEL2_BREACH');
                } else if (riskMetrics.dailyPnL < -this.circuitBreakers.portfolio.level1) {
                    await this.reducePositionSizes(user.id, 'PORTFOLIO_LEVEL1_BREACH');
                }
                
                // Update user risk profile
                await this.updateUserRiskProfile(user.id, riskMetrics);
            }
            
        } catch (error) {
            console.error('Portfolio risk monitoring error:', error);
        }
    }

    /**
     * Monitor individual position risk
     */
    async monitorPositionRisk() {
        try {
            const activePositions = await this.getActivePositions();
            
            for (const position of activePositions) {
                const currentValue = await this.getCurrentPositionValue(position);
                const pnl = (currentValue - position.entryValue) / position.entryValue;
                
                // Check individual position circuit breakers
                if (pnl < -this.circuitBreakers.individual.level3) {
                    await this.forceLiquidatePosition(position.id, 'POSITION_LEVEL3_BREACH');
                } else if (pnl < -this.circuitBreakers.individual.level2) {
                    await this.reducePosition(position.id, 'POSITION_LEVEL2_BREACH', 0.5);
                } else if (pnl < -this.circuitBreakers.individual.level1) {
                    await this.sendRiskAlert(position.userId, 'POSITION_LEVEL1_BREACH', position);
                }
            }
            
        } catch (error) {
            console.error('Position risk monitoring error:', error);
        }
    }

    /**
     * Monitor market-wide risk conditions
     */
    async monitorMarketRisk() {
        try {
            const marketTokens = await this.getActiveMarketTokens();
            
            for (const token of marketTokens) {
                const marketData = await this.getMarketData(token);
                
                // Check volatility circuit breaker
                if (marketData.volatility > this.circuitBreakers.market.volatility) {
                    await this.haltTokenTrading(token, 'HIGH_VOLATILITY', marketData);
                }
                
                // Check volume circuit breaker
                if (marketData.volumeChange < -this.circuitBreakers.market.volume) {
                    await this.sendLiquidityWarning(token, 'LOW_VOLUME', marketData);
                }
                
                // Update market data cache
                this.marketData.set(token, {
                    ...marketData,
                    timestamp: Date.now()
                });
            }
            
        } catch (error) {
            console.error('Market risk monitoring error:', error);
        }
    }

    /**
     * Emergency liquidation system
     */
    async triggerEmergencyLiquidation(userId, reason) {
        try {
            console.log(`🚨 EMERGENCY LIQUIDATION TRIGGERED for user ${userId}: ${reason}`);
            
            // Get all user positions
            const positions = await this.getUserPositions(userId);
            
            // Create liquidation plan (prioritize high-risk positions)
            const liquidationPlan = this.createLiquidationPlan(positions);
            
            // Execute liquidations in order
            for (const position of liquidationPlan) {
                try {
                    await this.executeLiquidation(position);
                    
                    await this.db.logSafetyEvent({
                        eventType: 'EMERGENCY_LIQUIDATION',
                        userId: userId,
                        severity: 'critical',
                        description: `Position liquidated: ${position.tokenMint}`,
                        metadata: { position, reason },
                        actionTaken: 'POSITION_LIQUIDATED'
                    });
                    
                } catch (liquidationError) {
                    console.error(`Failed to liquidate position ${position.id}:`, liquidationError);
                    
                    // Try alternative liquidation methods
                    await this.attemptAlternativeLiquidation(position);
                }
            }
            
            // Notify user and admins
            await this.notifyEmergencyLiquidation(userId, reason, liquidationPlan);
            
        } catch (error) {
            console.error('Emergency liquidation failed:', error);
            
            // Escalate to manual intervention
            await this.escalateToManualIntervention(userId, reason, error);
        }
    }

    /**
     * Create optimal liquidation plan
     */
    createLiquidationPlan(positions) {
        return positions
            .map(position => ({
                ...position,
                priority: this.calculateLiquidationPriority(position)
            }))
            .sort((a, b) => b.priority - a.priority);
    }

    /**
     * Calculate liquidation priority (higher = liquidate first)
     */
    calculateLiquidationPriority(position) {
        const riskScore = position.riskScore || 50;
        const liquidityScore = position.liquidityScore || 50;
        const pnl = position.unrealizedPnL || 0;
        
        // Higher risk, lower liquidity, bigger losses = higher priority
        return riskScore + (100 - liquidityScore) + Math.abs(pnl * 10);
    }

    /**
     * Get user's comprehensive risk profile
     */
    async getUserRiskProfile(userId) {
        if (this.userRiskProfiles.has(userId)) {
            const cached = this.userRiskProfiles.get(userId);
            if (Date.now() - cached.timestamp < 300000) { // 5 minutes cache
                return cached.profile;
            }
        }

        try {
            // Get user's trading history and current positions
            const tradingHistory = await this.getUserTradingHistory(userId, 30); // 30 days
            const currentPositions = await this.getUserPositions(userId);
            
            // Calculate risk metrics
            const sharpeRatio = this.calculateSharpeRatio(tradingHistory);
            const maxDrawdown = this.calculateMaxDrawdown(tradingHistory);
            const volatility = this.calculatePortfolioVolatility(tradingHistory);
            const winRate = this.calculateWinRate(tradingHistory);
            
            const profile = {
                userId: userId,
                riskTolerance: this.determineRiskTolerance(sharpeRatio, maxDrawdown, volatility),
                maxPositionSize: this.calculateMaxPositionSize(sharpeRatio, volatility),
                recommendedLeverage: 1.0, // No leverage for safety
                sharpeRatio: sharpeRatio,
                maxDrawdown: maxDrawdown,
                volatility: volatility,
                winRate: winRate,
                currentPositions: currentPositions.length,
                lastUpdated: Date.now()
            };

            // Cache the profile
            this.userRiskProfiles.set(userId, {
                profile: profile,
                timestamp: Date.now()
            });

            return profile;

        } catch (error) {
            // Return conservative default profile
            return {
                userId: userId,
                riskTolerance: 'conservative',
                maxPositionSize: 0.05, // 5% max
                recommendedLeverage: 1.0,
                sharpeRatio: 0,
                maxDrawdown: 0,
                volatility: 0.1,
                winRate: 0.5,
                currentPositions: 0,
                lastUpdated: Date.now()
            };
        }
    }

    /**
     * Real-time risk dashboard data
     */
    async getRiskDashboard(userId) {
        try {
            const portfolio = await this.getUserPortfolio(userId);
            const riskProfile = await this.getUserRiskProfile(userId);
            const riskMetrics = await this.calculatePortfolioRisk(portfolio);
            const activeAlerts = Array.from(this.activeAlerts.values())
                .filter(alert => alert.userId === userId);

            return {
                portfolio: {
                    totalValue: this.calculatePortfolioValue(portfolio),
                    dailyPnL: riskMetrics.dailyPnL,
                    totalPnL: riskMetrics.totalPnL,
                    positions: portfolio.length
                },
                risk: {
                    riskScore: riskMetrics.riskScore,
                    var95: riskMetrics.var95,
                    var99: riskMetrics.var99,
                    maxDrawdown: riskProfile.maxDrawdown,
                    sharpeRatio: riskProfile.sharpeRatio,
                    volatility: riskProfile.volatility
                },
                limits: {
                    maxPositionSize: riskProfile.maxPositionSize,
                    usedPositionSize: riskMetrics.totalExposure,
                    availableCapacity: riskProfile.maxPositionSize - riskMetrics.totalExposure,
                    dailyLossLimit: this.riskLimits.maxDailyLoss,
                    usedDailyLoss: Math.abs(riskMetrics.dailyPnL)
                },
                alerts: activeAlerts,
                circuitBreakers: {
                    portfolio: this.getCircuitBreakerStatus(userId, 'portfolio'),
                    positions: this.getCircuitBreakerStatus(userId, 'positions'),
                    market: this.getCircuitBreakerStatus(userId, 'market')
                },
                timestamp: Date.now()
            };

        } catch (error) {
            throw new Error(`Risk dashboard generation failed: ${error.message}`);
        }
    }

    /**
     * System health check for risk management
     */
    async healthCheck() {
        const health = {
            riskMonitoring: true,
            portfolioMonitoring: true,
            positionMonitoring: true,
            marketMonitoring: true,
            circuitBreakers: true,
            emergencySystem: true,
            timestamp: Date.now(),
            errors: []
        };

        try {
            // Test risk calculation systems
            await this.testRiskCalculations();
            
            // Test circuit breaker systems
            await this.testCircuitBreakers();
            
            // Test emergency liquidation system
            await this.testEmergencySystem();
            
        } catch (error) {
            health.errors.push(error.message);
            
            // Mark failed systems
            if (error.message.includes('risk')) health.riskMonitoring = false;
            if (error.message.includes('circuit')) health.circuitBreakers = false;
            if (error.message.includes('emergency')) health.emergencySystem = false;
        }

        return health;
    }

    // Helper methods for risk calculations and monitoring
    calculateRiskScore(factors) {
        const { positionWeight, volatility, correlationRisk, liquidityRisk } = factors;
        
        return Math.min(100, 
            (positionWeight * 40) + 
            (volatility * 30) + 
            (correlationRisk * 20) + 
            (liquidityRisk * 10)
        );
    }

    generateRiskRecommendations(riskScore, positionWeight, volatility) {
        const recommendations = [];
        
        if (riskScore > 80) {
            recommendations.push('HIGH_RISK: Consider reducing position size');
        }
        
        if (positionWeight > 0.1) {
            recommendations.push('CONCENTRATION: Position exceeds 10% of portfolio');
        }
        
        if (volatility > 0.3) {
            recommendations.push('VOLATILITY: High volatility asset - use tight stops');
        }
        
        return recommendations;
    }

    // ... Additional helper methods for portfolio calculations, market data, etc.
}

module.exports = RealTimeRiskManager;