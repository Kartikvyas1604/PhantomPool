/**
 * Orders Routes
 * API endpoints for encrypted order management
 */

import { Router } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { validateOrderSubmission, validatePagination, validateUUID } from '../middleware/validation.middleware';
import { asyncHandler, PhantomPoolError } from '../middleware/error.middleware';
import { DatabaseService } from '../services/database.service';
import { ProductionMatchingEngine } from '../services/matching.production.service';
import { logger } from '../utils/logger';

interface CryptoServices {
  elgamal: any;
  bulletproofs: any;
  vrf: any;
  zkProof: any;
}

export const orderRoutes = (
  db: DatabaseService,
  matchingEngine: ProductionMatchingEngine,
  cryptoServices: CryptoServices
) => {
  const router = Router();

  /**
   * POST /api/orders
   * Submit a new encrypted order
   */
  router.post('/', validateOrderSubmission, asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) {
      throw new PhantomPoolError('Authentication required', 401);
    }

    const startTime = Date.now();
    const {
      trading_pair_id,
      order_type,
      side,
      encrypted_amount,
      encrypted_price,
      solvency_proof,
      signature_proof,
      nonce,
      expiry_time
    } = req.body;

    logger.audit('order_submission_attempt', req.user.id, {
      trading_pair_id,
      order_type,
      side,
      nonce,
    });

    try {
      // Validate solvency proof
      const solvencyValid = await cryptoServices.bulletproofs.verifySolvencyProof(solvency_proof);
      if (!solvencyValid) {
        throw new PhantomPoolError('Invalid solvency proof', 400, 'INVALID_PROOF');
      }

      // Submit order to database
      const orderId = await db.submitEncryptedOrder({
        user_id: req.user.id,
        trading_pair_id,
        order_type,
        side,
        encrypted_amount,
        encrypted_price,
        solvency_proof,
        signature_proof,
        nonce,
        expiry_time,
      });

      // Submit to matching engine
      const matchingResult = await matchingEngine.submitOrder({
        id: orderId,
        userId: req.user.id,
        marketPair: trading_pair_id,
        side,
        encryptedAmount: JSON.parse(encrypted_amount),
        encryptedPrice: JSON.parse(encrypted_price),
        timestamp: Date.now(),
        nonce,
        solvencyProof: solvency_proof,
        signature: signature_proof,
      });

      const duration = Date.now() - startTime;
      logger.performance('order_submission', duration, { orderId, success: matchingResult.success });

      logger.audit('order_submitted', req.user.id, {
        order_id: orderId,
        trading_pair_id,
        order_type,
        side,
        success: matchingResult.success,
      });

      res.status(201).json({
        success: true,
        data: {
          order_id: orderId,
          status: 'submitted',
          pool_position: matchingResult.poolPosition,
          estimated_match_time: matchingResult.estimatedMatchTime,
        },
        metadata: {
          processing_time_ms: duration,
          timestamp: new Date().toISOString(),
        },
      });

    } catch (error) {
      logger.error('Order submission failed', {
        user_id: req.user.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        nonce,
      });
      throw error;
    }
  }));

  /**
   * GET /api/orders
   * Get user's orders with pagination
   */
  router.get('/', validatePagination, asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) {
      throw new PhantomPoolError('Authentication required', 401);
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const status = req.query.status as string;

    logger.database('select', 'encrypted_orders', { user_id: req.user.id, limit, offset });

    const orders = await db.getUserOrders(req.user.id, limit, offset);

    // Filter by status if provided
    const filteredOrders = status 
      ? orders.filter(order => (order as any).status === status)
      : orders;

    res.json({
      success: true,
      data: filteredOrders,
      pagination: {
        limit,
        offset,
        total: filteredOrders.length,
        has_more: filteredOrders.length === limit,
      },
      metadata: {
        timestamp: new Date().toISOString(),
      },
    });
  }));

  /**
   * GET /api/orders/:orderId
   * Get specific order details
   */
  router.get('/:orderId', validateUUID('orderId'), asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) {
      throw new PhantomPoolError('Authentication required', 401);
    }

    const { orderId } = req.params;

    const order = await db.getOrderById(orderId);
    
    if (!order) {
      throw new PhantomPoolError('Order not found', 404, 'ORDER_NOT_FOUND');
    }

    // Ensure user can only see their own orders
    if ((order as any).user_id !== req.user.id) {
      throw new PhantomPoolError('Access denied', 403, 'ACCESS_DENIED');
    }

    res.json({
      success: true,
      data: order,
      metadata: {
        timestamp: new Date().toISOString(),
      },
    });
  }));

  /**
   * PUT /api/orders/:orderId/cancel
   * Cancel an order
   */
  router.put('/:orderId/cancel', validateUUID('orderId'), asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) {
      throw new PhantomPoolError('Authentication required', 401);
    }

    const { orderId } = req.params;

    // Verify order exists and belongs to user
    const existingOrder = await db.getOrderById(orderId);
    if (!existingOrder) {
      throw new PhantomPoolError('Order not found', 404, 'ORDER_NOT_FOUND');
    }

    if ((existingOrder as any).user_id !== req.user.id) {
      throw new PhantomPoolError('Access denied', 403, 'ACCESS_DENIED');
    }

    if (!['active', 'partially_filled'].includes((existingOrder as any).status)) {
      throw new PhantomPoolError('Order cannot be cancelled', 400, 'INVALID_STATUS');
    }

    // Cancel the order
    const cancelledOrder = await db.cancelOrder(orderId, req.user.id);

    logger.audit('order_cancelled', req.user.id, {
      order_id: orderId,
      original_status: (existingOrder as any).status,
    });

    res.json({
      success: true,
      data: {
        order_id: orderId,
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      },
      metadata: {
        timestamp: new Date().toISOString(),
      },
    });
  }));

  /**
   * GET /api/orders/:orderId/status
   * Get order status and matching progress
   */
  router.get('/:orderId/status', validateUUID('orderId'), asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) {
      throw new PhantomPoolError('Authentication required', 401);
    }

    const { orderId } = req.params;

    const order = await db.getOrderById(orderId);
    
    if (!order) {
      throw new PhantomPoolError('Order not found', 404, 'ORDER_NOT_FOUND');
    }

    if ((order as any).user_id !== req.user.id) {
      throw new PhantomPoolError('Access denied', 403, 'ACCESS_DENIED');
    }

    // Get order book state for estimated matching time
    const tradingPairId = (order as any).trading_pair_id;
    const orderBookState = matchingEngine.getOrderBookState(tradingPairId);

    res.json({
      success: true,
      data: {
        order_id: orderId,
        status: (order as any).status,
        filled_amount: (order as any).filled_amount || 0,
        remaining_amount: (order as any).remaining_amount || 0,
        created_at: (order as any).created_at,
        updated_at: (order as any).updated_at,
        expires_at: (order as any).expires_at,
        order_book: {
          buy_orders: orderBookState.buyOrders,
          sell_orders: orderBookState.sellOrders,
          estimated_match_time: 30000, // 30 seconds estimate
        },
      },
      metadata: {
        timestamp: new Date().toISOString(),
      },
    });
  }));

  /**
   * GET /api/orders/stats
   * Get user's order statistics
   */
  router.get('/stats', asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) {
      throw new PhantomPoolError('Authentication required', 401);
    }

    // Get all user orders for statistics
    const orders = await db.getUserOrders(req.user.id, 1000, 0);
    
    const stats = {
      total_orders: orders.length,
      active_orders: orders.filter(o => (o as any).status === 'active').length,
      filled_orders: orders.filter(o => (o as any).status === 'filled').length,
      cancelled_orders: orders.filter(o => (o as any).status === 'cancelled').length,
      partially_filled_orders: orders.filter(o => (o as any).status === 'partially_filled').length,
      buy_orders: orders.filter(o => (o as any).side === 'buy').length,
      sell_orders: orders.filter(o => (o as any).side === 'sell').length,
    };

    res.json({
      success: true,
      data: stats,
      metadata: {
        timestamp: new Date().toISOString(),
      },
    });
  }));

  return router;
};