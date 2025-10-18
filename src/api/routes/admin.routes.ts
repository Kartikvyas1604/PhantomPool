/**
 * Admin Routes
 * Administrative endpoints for system management
 */

import { Router, Request, Response } from 'express';
import { authMiddleware, requireTradingTier } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { logger } from '../utils/logger';

interface AdminServices {
  db?: any;
  orderService?: any;
  matchingEngine?: any;
  executorCoordinator?: any;
  metricsService?: any;
}

export const adminRoutes = (services: AdminServices = {}) => {
  const router = Router();

  // All admin routes require authentication and admin privileges
  router.use(authMiddleware);
  router.use(requireTradingTier('admin'));

  /**
   * GET /api/admin/dashboard
   * Admin dashboard overview
   */
  router.get('/dashboard', asyncHandler(async (req: Request, res: Response) => {
    const dashboard = {
      system: {
        uptime: Math.floor(process.uptime()),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        memory: process.memoryUsage(),
      },
      statistics: {
        total_orders: 0,
        active_orders: 0,
        completed_trades: 0,
        total_volume: '0',
        users: {
          total: 0,
          active_24h: 0,
        },
      },
      network: {
        executor_nodes: 0,
        healthy_nodes: 0,
        network_status: 'unknown',
      },
    };

    // Get order statistics
    if (services.orderService && typeof services.orderService.getStatistics === 'function') {
      try {
        const orderStats = await services.orderService.getStatistics();
        dashboard.statistics.total_orders = orderStats.total_orders || 0;
        dashboard.statistics.active_orders = orderStats.active_orders || 0;
        dashboard.statistics.completed_trades = orderStats.completed_trades || 0;
        dashboard.statistics.total_volume = orderStats.total_volume || '0';
      } catch (error) {
        logger.error('Failed to get order statistics', error);
      }
    }

    // Get user statistics
    if (services.db && typeof services.db.getUserStatistics === 'function') {
      try {
        const userStats = await services.db.getUserStatistics();
        dashboard.statistics.users = userStats;
      } catch (error) {
        logger.error('Failed to get user statistics', error);
      }
    }

    // Get network status
    if (services.executorCoordinator && typeof services.executorCoordinator.getNetworkHealth === 'function') {
      try {
        const networkHealth = await services.executorCoordinator.getNetworkHealth();
        dashboard.network = {
          executor_nodes: networkHealth.total_nodes || 0,
          healthy_nodes: networkHealth.healthy_nodes || 0,
          network_status: networkHealth.healthy ? 'healthy' : 'degraded',
        };
      } catch (error) {
        logger.error('Failed to get network health', error);
      }
    }

    logger.audit(`Admin dashboard accessed by ${req.user?.userId}`, {
      userId: req.user?.userId,
      dashboard,
    });

    res.json({
      success: true,
      data: dashboard,
      timestamp: new Date().toISOString(),
    });
  }));

  /**
   * GET /api/admin/orders
   * List all orders with admin view
   */
  router.get('/orders', asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const status = req.query.status as string;
    const userId = req.query.userId as string;

    const filters: any = {};
    if (status) filters.status = status;
    if (userId) filters.userId = userId;

    let orders: any[] = [];
    let totalCount = 0;

    if (services.orderService && typeof services.orderService.getOrdersAdmin === 'function') {
      try {
        const result = await services.orderService.getOrdersAdmin({
          page,
          limit,
          filters,
        });
        orders = result.orders || [];
        totalCount = result.totalCount || 0;
      } catch (error) {
        logger.error('Failed to get admin orders', error);
        throw new Error('Failed to retrieve orders');
      }
    }

    logger.audit(`Admin orders list accessed`, {
      adminId: req.user?.userId,
      filters,
      page,
      limit,
      totalCount,
    });

    res.json({
      success: true,
      data: {
        orders,
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
   * POST /api/admin/orders/:orderId/cancel
   * Admin cancel order
   */
  router.post('/orders/:orderId/cancel', 
    validate('adminCancelOrder'),
    asyncHandler(async (req: Request, res: Response) => {
      const { orderId } = req.params;
      const { reason } = req.body;

      if (!services.orderService || typeof services.orderService.adminCancelOrder !== 'function') {
        throw new Error('Order service not available');
      }

      const result = await services.orderService.adminCancelOrder(orderId, {
        adminId: req.user?.userId,
        reason: reason || 'Administrative cancellation',
      });

      logger.audit(`Admin cancelled order ${orderId}`, {
        adminId: req.user?.userId,
        orderId,
        reason,
      });

      res.json({
        success: true,
        data: result,
        message: 'Order cancelled successfully',
      });
    })
  );

  /**
   * GET /api/admin/users
   * List users with admin view
   */
  router.get('/users', asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const search = req.query.search as string;

    let users: any[] = [];
    let totalCount = 0;

    if (services.db && typeof services.db.getUsersAdmin === 'function') {
      try {
        const result = await services.db.getUsersAdmin({
          page,
          limit,
          search,
        });
        users = result.users || [];
        totalCount = result.totalCount || 0;
      } catch (error) {
        logger.error('Failed to get admin users', error);
        throw new Error('Failed to retrieve users');
      }
    }

    logger.audit(`Admin users list accessed`, {
      adminId: req.user?.userId,
      search,
      page,
      limit,
      totalCount,
    });

    res.json({
      success: true,
      data: {
        users,
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
   * PUT /api/admin/users/:userId/status
   * Update user status
   */
  router.put('/users/:userId/status',
    validate('adminUpdateUserStatus'),
    asyncHandler(async (req: Request, res: Response) => {
      const { userId } = req.params;
      const { status, reason } = req.body;

      if (!services.db || typeof services.db.updateUserStatus !== 'function') {
        throw new Error('Database service not available');
      }

      const result = await services.db.updateUserStatus(userId, {
        status,
        reason,
        adminId: req.user?.userId,
        timestamp: new Date(),
      });

      logger.audit(`Admin updated user ${userId} status to ${status}`, {
        adminId: req.user?.userId,
        targetUserId: userId,
        newStatus: status,
        reason,
      });

      res.json({
        success: true,
        data: result,
        message: 'User status updated successfully',
      });
    })
  );

  /**
   * GET /api/admin/system/config
   * Get system configuration
   */
  router.get('/system/config', asyncHandler(async (req: Request, res: Response) => {
    const config = {
      trading: {
        max_order_size: process.env.MAX_ORDER_SIZE || '1000000',
        min_order_size: process.env.MIN_ORDER_SIZE || '1',
        supported_tokens: process.env.SUPPORTED_TOKENS?.split(',') || ['SOL', 'USDC'],
        fee_structure: {
          maker_fee: '0.001',
          taker_fee: '0.002',
        },
      },
      network: {
        executor_threshold: parseInt(process.env.EXECUTOR_THRESHOLD || '3'),
        network_timeout: parseInt(process.env.NETWORK_TIMEOUT || '30000'),
        max_retry_attempts: parseInt(process.env.MAX_RETRY_ATTEMPTS || '3'),
      },
      security: {
        jwt_expiry: process.env.JWT_EXPIRY || '24h',
        rate_limit_window: process.env.RATE_LIMIT_WINDOW || '15m',
        rate_limit_max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
      },
    };

    logger.audit(`Admin accessed system config`, {
      adminId: req.user?.userId,
    });

    res.json({
      success: true,
      data: config,
    });
  }));

  /**
   * POST /api/admin/system/maintenance
   * Toggle maintenance mode
   */
  router.post('/system/maintenance',
    validate('adminMaintenanceMode'),
    asyncHandler(async (req: Request, res: Response) => {
      const { enabled, message } = req.body;

      // In a real implementation, this would update a global state
      // For now, we'll just log the action
      logger.audit(`Admin ${enabled ? 'enabled' : 'disabled'} maintenance mode`, {
        adminId: req.user?.userId,
        enabled,
        message,
      });

      res.json({
        success: true,
        data: {
          maintenance_mode: enabled,
          message: message || (enabled ? 'System is in maintenance mode' : 'System is operational'),
          timestamp: new Date().toISOString(),
        },
      });
    })
  );

  /**
   * GET /api/admin/logs
   * Get system logs
   */
  router.get('/logs', asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
    const level = req.query.level as string;
    const search = req.query.search as string;

    // Mock log response - in production, integrate with actual logging system
    const logs = {
      entries: [
        {
          timestamp: new Date().toISOString(),
          level: 'info',
          message: 'System startup complete',
          metadata: { component: 'server' },
        },
        {
          timestamp: new Date(Date.now() - 60000).toISOString(),
          level: 'warn',
          message: 'High memory usage detected',
          metadata: { component: 'monitor', memory_percent: 85 },
        },
      ],
      pagination: {
        page,
        limit,
        totalCount: 2,
        totalPages: 1,
      },
    };

    logger.audit(`Admin accessed system logs`, {
      adminId: req.user?.userId,
      filters: { level, search },
      page,
      limit,
    });

    res.json({
      success: true,
      data: logs,
    });
  }));

  /**
   * GET /api/admin/metrics
   * Get detailed system metrics
   */
  router.get('/metrics', asyncHandler(async (req: Request, res: Response) => {
    const timeframe = req.query.timeframe as string || '1h';
    
    let metrics: any = {
      performance: {
        avg_response_time: 0,
        requests_per_second: 0,
        error_rate: 0,
      },
      trading: {
        orders_per_minute: 0,
        successful_matches: 0,
        failed_matches: 0,
        average_execution_time: 0,
      },
      system: {
        cpu_usage: 0,
        memory_usage: process.memoryUsage(),
        active_connections: 0,
      },
    };

    if (services.metricsService && typeof services.metricsService.getMetrics === 'function') {
      try {
        metrics = await services.metricsService.getMetrics(timeframe);
      } catch (error) {
        logger.error('Failed to get detailed metrics', error);
      }
    }

    logger.audit(`Admin accessed detailed metrics`, {
      adminId: req.user?.userId,
      timeframe,
    });

    res.json({
      success: true,
      data: metrics,
      timeframe,
      timestamp: new Date().toISOString(),
    });
  }));

  return router;
};