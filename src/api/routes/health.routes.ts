/**
 * Health Routes
 * System health monitoring and status endpoints
 */

import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import { logger } from '../utils/logger';

interface HealthServices {
  db?: any;
  matchingEngine?: any;
  executorCoordinator?: any;
}

export const healthRoutes = (services: HealthServices = {}) => {
  const router = Router();

  /**
   * GET /api/health
   * Basic health check
   */
  router.get('/', (req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: Math.floor(process.uptime()),
    });
  });

  /**
   * GET /api/health/detailed
   * Detailed system health check
   */
  router.get('/detailed', asyncHandler(async (req: Request, res: Response) => {
    const checks: Record<string, any> = {
      api: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        memory: process.memoryUsage(),
      },
    };

    // Database health check
    try {
      if (services.db && typeof services.db.healthCheck === 'function') {
        const dbHealth = await services.db.healthCheck();
        checks.database = {
          status: dbHealth.healthy ? 'healthy' : 'unhealthy',
          details: dbHealth,
        };
      } else {
        checks.database = {
          status: 'unknown',
          message: 'Database service not available',
        };
      }
    } catch (error) {
      checks.database = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    // Matching engine health check
    try {
      if (services.matchingEngine && typeof services.matchingEngine.getSystemHealth === 'function') {
        const matchingHealth = services.matchingEngine.getSystemHealth();
        checks.matching_engine = {
          status: matchingHealth.status,
          details: matchingHealth,
        };
      } else {
        checks.matching_engine = {
          status: 'unknown',
          message: 'Matching engine service not available',
        };
      }
    } catch (error) {
      checks.matching_engine = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    // Executor network health check
    try {
      if (services.executorCoordinator && typeof services.executorCoordinator.getNetworkHealth === 'function') {
        const executorHealth = await services.executorCoordinator.getNetworkHealth();
        checks.executor_network = {
          status: executorHealth.healthy ? 'healthy' : 'degraded',
          details: executorHealth,
        };
      } else {
        checks.executor_network = {
          status: 'unknown',
          message: 'Executor coordinator service not available',
        };
      }
    } catch (error) {
      checks.executor_network = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    // Overall system status
    const allStatuses = Object.values(checks).map(check => check.status);
    const overallStatus = allStatuses.includes('unhealthy') ? 'unhealthy' :
                         allStatuses.includes('degraded') ? 'degraded' :
                         allStatuses.includes('unknown') ? 'unknown' : 'healthy';

    res.json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks,
    });
  }));

  /**
   * GET /api/health/metrics
   * System performance metrics
   */
  router.get('/metrics', asyncHandler(async (req: Request, res: Response) => {
    const metrics = {
      process: {
        uptime: Math.floor(process.uptime()),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        pid: process.pid,
        version: process.version,
        platform: process.platform,
      },
      system: {
        timestamp: new Date().toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        load_average: process.platform === 'linux' ? require('os').loadavg() : null,
      },
    };

    // Add service-specific metrics if available
    if (services.db && typeof services.db.getMetrics === 'function') {
      try {
        metrics.database = await services.db.getMetrics();
      } catch (error) {
        logger.error('Failed to get database metrics', error);
      }
    }

    if (services.matchingEngine && typeof services.matchingEngine.getMetrics === 'function') {
      try {
        metrics.matching_engine = services.matchingEngine.getMetrics();
      } catch (error) {
        logger.error('Failed to get matching engine metrics', error);
      }
    }

    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString(),
    });
  }));

  /**
   * GET /api/health/readiness
   * Kubernetes readiness probe endpoint
   */
  router.get('/readiness', asyncHandler(async (req: Request, res: Response) => {
    let isReady = true;
    const checks: string[] = [];

    // Check database connectivity
    try {
      if (services.db && typeof services.db.healthCheck === 'function') {
        const dbHealth = await services.db.healthCheck();
        if (!dbHealth.healthy) {
          isReady = false;
          checks.push('database_not_ready');
        }
      }
    } catch (error) {
      isReady = false;
      checks.push('database_error');
    }

    // Check critical services
    if (services.matchingEngine && typeof services.matchingEngine.getSystemHealth === 'function') {
      try {
        const matchingHealth = services.matchingEngine.getSystemHealth();
        if (matchingHealth.status === 'unhealthy') {
          isReady = false;
          checks.push('matching_engine_not_ready');
        }
      } catch (error) {
        isReady = false;
        checks.push('matching_engine_error');
      }
    }

    if (isReady) {
      res.json({
        status: 'ready',
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        status: 'not_ready',
        checks,
        timestamp: new Date().toISOString(),
      });
    }
  }));

  /**
   * GET /api/health/liveness
   * Kubernetes liveness probe endpoint
   */
  router.get('/liveness', (req: Request, res: Response) => {
    // Simple liveness check - if we can respond, we're alive
    res.json({
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
    });
  });

  /**
   * GET /api/health/components
   * Individual component health status
   */
  router.get('/components', asyncHandler(async (req: Request, res: Response) => {
    const components = {
      api_server: {
        status: 'healthy',
        uptime: Math.floor(process.uptime()),
        memory_usage: process.memoryUsage(),
      },
      crypto_services: {
        status: 'healthy', // Mock status - in production check actual services
        services: ['elgamal', 'bulletproofs', 'vrf', 'zkproof'],
      },
      threshold_network: {
        status: 'unknown',
        nodes: 5,
        active_nodes: 0,
      },
    };

    // Check executor network if available
    if (services.executorCoordinator && typeof services.executorCoordinator.getExecutorHealth === 'function') {
      try {
        const executorStatus = await services.executorCoordinator.getExecutorHealth();
        components.threshold_network = {
          status: executorStatus.healthy_nodes >= 3 ? 'healthy' : 'degraded',
          nodes: executorStatus.total_nodes,
          active_nodes: executorStatus.healthy_nodes,
        };
      } catch (error) {
        components.threshold_network.status = 'error';
      }
    }

    res.json({
      success: true,
      data: components,
      timestamp: new Date().toISOString(),
    });
  }));

  return router;
};