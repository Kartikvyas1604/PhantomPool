/**
 * Trading Routes
 * Core trading functionality endpoints
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { logger } from '../utils/logger';
import { NotFoundError, ValidationError } from '../types/api.types';

interface TradingServices {
  matchingEngine?: any;
  orderService?: any;
  executorCoordinator?: any;
}

export const tradingRoutes = (services: TradingServices = {}) => {
  const router = Router();

  // All trading routes require authentication
  router.use(authMiddleware as any);

  /**
   * GET /api/trading/orderbook/:token
   * Get order book for a specific token
   */
  router.get('/orderbook/:token', asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.params;
    const depth = parseInt(req.query.depth as string) || 10;

    if (!token) {
      throw new ValidationError('Token parameter is required');
    }

    let orderbook: any = {
      token,
      bids: [],
      asks: [],
      spread: '0',
      lastUpdate: new Date(),
    };

    if (services.matchingEngine && typeof services.matchingEngine.getOrderBook === 'function') {
      try {
        orderbook = await services.matchingEngine.getOrderBook(token, { depth });
      } catch (error) {
        logger.error(`Failed to get orderbook for ${token}`, error);
        throw new Error('Failed to retrieve order book');
      }
    }

    res.json({
      success: true,
      data: orderbook,
      timestamp: new Date().toISOString(),
    });
  }));

  /**
   * POST /api/trading/match
   * Submit a trade match request
   */
  router.post('/match', 
    validate([
      { field: 'orderId', required: true, type: 'string' },
      { field: 'counterOrderId', required: true, type: 'string' },
      { field: 'amount', required: true, type: 'string' },
      { field: 'price', required: true, type: 'string' },
      { field: 'zkMatchProof', required: true, type: 'string' },
    ]),
    asyncHandler(async (req: Request, res: Response) => {
      const { orderId, counterOrderId, amount, price, zkMatchProof } = req.body;

      // Verify user owns at least one of the orders
      if (!services.orderService || typeof services.orderService.getOrder !== 'function') {
        throw new Error('Order service not available');
      }

      let userOwnsOrder = false;
      try {
        await services.orderService.getOrder(orderId, req.user!.userId);
        userOwnsOrder = true;
      } catch {
        try {
          await services.orderService.getOrder(counterOrderId, req.user!.userId);
          userOwnsOrder = true;
        } catch {
          throw new ValidationError('User must own at least one of the orders');
        }
      }

      if (!services.matchingEngine || typeof services.matchingEngine.submitTrade !== 'function') {
        throw new Error('Matching engine not available');
      }

      const tradeRequest = {
        orderId,
        counterOrderId,
        amount,
        price,
        zkMatchProof,
      };

      const trade = await services.matchingEngine.submitTrade(tradeRequest);

      logger.info(`Trade match submitted`, {
        userId: req.user!.userId,
        tradeId: trade.id,
        orderId,
        counterOrderId,
        amount,
        price,
      });

      res.status(201).json({
        success: true,
        data: trade,
        message: 'Trade match submitted successfully',
      });
    })
  );

  /**
   * GET /api/trading/trades
   * Get user's trade history
   */
  router.get('/trades', asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const token = req.query.token as string;
    const status = req.query.status as string;

    const filters: any = {
      userId: req.user!.userId,
    };
    if (token) filters.token = token;
    if (status) filters.status = status;

    // Mock trade history - in production would query actual trades
    const trades: any[] = [
      {
        id: `trade_${Date.now()}`,
        buyOrderId: 'order_1',
        sellOrderId: 'order_2',
        amount: '100.0',
        price: '2.50',
        timestamp: new Date(),
        status: 'confirmed',
        transactionHash: '0x123...',
        zkProof: 'proof_data',
      },
    ];

    const totalCount = trades.length;

    res.json({
      success: true,
      data: {
        trades: trades.slice((page - 1) * limit, page * limit),
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      },
    });
  }));

  /**
   * GET /api/trading/trade/:tradeId
   * Get specific trade details
   */
  router.get('/trade/:tradeId', asyncHandler(async (req: Request, res: Response) => {
    const { tradeId } = req.params;

    // Mock trade lookup - in production would verify user access and query trade
    const trade = {
      id: tradeId,
      buyOrderId: 'order_1',
      sellOrderId: 'order_2',
      amount: '100.0',
      price: '2.50',
      timestamp: new Date(),
      status: 'confirmed',
      transactionHash: '0x123...',
      zkProof: 'proof_data',
    };

    if (!trade) {
      throw new NotFoundError('Trade not found');
    }

    res.json({
      success: true,
      data: trade,
    });
  }));

  /**
   * GET /api/trading/market-data/:token
   * Get market data for a token
   */
  router.get('/market-data/:token', asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.params;
    const timeframe = req.query.timeframe as string || '24h';

    // Mock market data - in production would aggregate from trades
    const marketData = {
      token,
      price: '2.50',
      change24h: '+0.05',
      changePercent24h: '+2.0',
      volume24h: '10000.0',
      high24h: '2.55',
      low24h: '2.45',
      trades24h: 150,
      lastUpdate: new Date(),
      timeframe,
    };

    res.json({
      success: true,
      data: marketData,
      timestamp: new Date().toISOString(),
    });
  }));

  /**
   * GET /api/trading/portfolio
   * Get user's portfolio summary
   */
  router.get('/portfolio', asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;

    // Mock portfolio data - in production would calculate from orders and trades
    const portfolio = {
      totalValue: '10000.0',
      totalPnl: '+500.0',
      totalPnlPercent: '+5.0',
      positions: [
        {
          token: 'SOL',
          amount: '100.0',
          averagePrice: '50.0',
          currentPrice: '55.0',
          pnl: '+500.0',
          pnlPercent: '+10.0',
        },
        {
          token: 'USDC',
          amount: '5000.0',
          averagePrice: '1.0',
          currentPrice: '1.0',
          pnl: '0.0',
          pnlPercent: '0.0',
        },
      ],
      recentTrades: [],
      activeOrders: 0,
    };

    // Get active orders count if service available
    if (services.orderService && typeof services.orderService.getStatistics === 'function') {
      try {
        const stats = await services.orderService.getStatistics(userId);
        portfolio.activeOrders = stats.activeOrders;
      } catch (error) {
        logger.error('Failed to get user order statistics', error);
      }
    }

    res.json({
      success: true,
      data: portfolio,
    });
  }));

  /**
   * GET /api/trading/stats
   * Get trading statistics for user
   */
  router.get('/stats', asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const timeframe = req.query.timeframe as string || '30d';

    // Mock trading stats - in production would calculate from user's trading history
    const stats = {
      timeframe,
      totalTrades: 25,
      successfulTrades: 23,
      failedTrades: 2,
      totalVolume: '50000.0',
      averageTradeSize: '2000.0',
      totalFees: '25.0',
      profitLoss: '+1250.0',
      winRate: '92.0',
      avgExecutionTime: 150,
      bestTrade: '+500.0',
      worstTrade: '-100.0',
    };

    // Get real stats if service available
    if (services.orderService && typeof services.orderService.getStatistics === 'function') {
      try {
        const orderStats = await services.orderService.getStatistics(userId);
        stats.totalTrades = orderStats.completedOrders;
        stats.totalVolume = orderStats.totalVolume;
        stats.averageTradeSize = orderStats.averageOrderSize;
      } catch (error) {
        logger.error('Failed to get user trading statistics', error);
      }
    }

    res.json({
      success: true,
      data: stats,
    });
  }));

  /**
   * POST /api/trading/threshold-decrypt
   * Request threshold decryption for matched orders
   */
  router.post('/threshold-decrypt',
    validate([
      { field: 'encryptedData', required: true, type: 'object' },
      { field: 'proofOfDecryption', required: true, type: 'string' },
      { field: 'requiredShares', required: true, type: 'number', min: 1, max: 10 },
    ]),
    asyncHandler(async (req: Request, res: Response) => {
      const { encryptedData, proofOfDecryption, requiredShares } = req.body;

      if (!services.executorCoordinator || typeof services.executorCoordinator.requestThresholdDecryption !== 'function') {
        throw new Error('Executor coordinator service not available');
      }

      const decryptionRequest = {
        encryptedData,
        proofOfDecryption,
        requiredShares,
      };

      const result = await services.executorCoordinator.requestThresholdDecryption(decryptionRequest);

      logger.info(`Threshold decryption requested`, {
        userId: req.user!.userId,
        requiredShares,
        success: result.threshold_met || false,
      });

      res.json({
        success: true,
        data: result,
        message: 'Threshold decryption request processed',
      });
    })
  );

  return router;
};