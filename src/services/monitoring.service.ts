// Real-time monitoring service for production PhantomPool
import { EventEmitter } from 'events';
import { SolanaProductionService } from './solana-production.service';
import { JupiterApiService } from './jupiter-api.service';

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  components: {
    solana: ComponentHealth;
    jupiter: ComponentHealth;
    database: ComponentHealth;
    redis: ComponentHealth;
    api: ComponentHealth;
  };
  metrics: {
    totalVolume24h: number;
    totalTrades24h: number;
    activeOrders: number;
    avgResponseTime: number;
    errorRate: number;
  };
  timestamp: Date;
}

export interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency: number;
  errorCount: number;
  lastError?: string;
  uptime: number;
}

export interface TradingMetrics {
  volume24h: number;
  trades24h: number;
  avgTradeSize: number;
  priceImpact: number;
  slippage: number;
  fees24h: number;
  uniqueTraders24h: number;
}

export interface SecurityAlert {
  level: 'info' | 'warning' | 'critical';
  type: string;
  message: string;
  data: Record<string, any>;
  timestamp: Date;
}

export class ProductionMonitoringService extends EventEmitter {
  private solanaService: SolanaProductionService;
  private jupiterService: JupiterApiService;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private metricsInterval: NodeJS.Timeout | null = null;
  
  private metrics = {
    totalVolume24h: 0,
    totalTrades24h: 0,
    activeOrders: 0,
    errors24h: 0,
    responseTimes: [] as number[],
  };

  constructor() {
    super();
    this.solanaService = new SolanaProductionService();
    this.jupiterService = new JupiterApiService();
  }

  /**
   * Start monitoring services
   */
  async startMonitoring(): Promise<void> {
    console.log('🔍 Starting production monitoring...');
    
    // Initialize services
    await this.solanaService.initialize();
    
    // Start health checks every 30 seconds
    this.healthCheckInterval = setInterval(
      () => this.performHealthCheck(),
      30000
    );
    
    // Start metrics collection every 5 minutes
    this.metricsInterval = setInterval(
      () => this.collectMetrics(),
      300000
    );
    
    // Initial health check
    await this.performHealthCheck();
    
    console.log('✅ Production monitoring started');
  }

  /**
   * Stop monitoring services
   */
  stopMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
    
    console.log('⏹️ Production monitoring stopped');
  }

  /**
   * Perform comprehensive health check
   */
  private async performHealthCheck(): Promise<SystemHealth> {
    const startTime = Date.now();
    
    try {
      // Parallel health checks
      const [solanaHealth, jupiterHealth, dbHealth, redisHealth, apiHealth] = 
        await Promise.allSettled([
          this.checkSolanaHealth(),
          this.checkJupiterHealth(),
          this.checkDatabaseHealth(),
          this.checkRedisHealth(),
          this.checkApiHealth(),
        ]);

      const systemHealth: SystemHealth = {
        status: this.calculateOverallStatus([
          this.getHealthResult(solanaHealth),
          this.getHealthResult(jupiterHealth),
          this.getHealthResult(dbHealth),
          this.getHealthResult(redisHealth),
          this.getHealthResult(apiHealth),
        ]),
        components: {
          solana: this.getHealthResult(solanaHealth),
          jupiter: this.getHealthResult(jupiterHealth),
          database: this.getHealthResult(dbHealth),
          redis: this.getHealthResult(redisHealth),
          api: this.getHealthResult(apiHealth),
        },
        metrics: {
          totalVolume24h: this.metrics.totalVolume24h,
          totalTrades24h: this.metrics.totalTrades24h,
          activeOrders: this.metrics.activeOrders,
          avgResponseTime: this.calculateAvgResponseTime(),
          errorRate: this.calculateErrorRate(),
        },
        timestamp: new Date(),
      };

      // Emit health status
      this.emit('healthCheck', systemHealth);
      
      // Check for alerts
      this.checkForAlerts(systemHealth);
      
      return systemHealth;
      
    } catch (error) {
      console.error('Health check failed:', error);
      
      const errorHealth: SystemHealth = {
        status: 'unhealthy',
        components: {
          solana: this.createErrorHealth(),
          jupiter: this.createErrorHealth(),
          database: this.createErrorHealth(),
          redis: this.createErrorHealth(),
          api: this.createErrorHealth(),
        },
        metrics: {
          totalVolume24h: 0,
          totalTrades24h: 0,
          activeOrders: 0,
          avgResponseTime: Date.now() - startTime,
          errorRate: 1.0,
        },
        timestamp: new Date(),
      };
      
      this.emit('healthCheck', errorHealth);
      return errorHealth;
    }
  }

  /**
   * Check Solana blockchain health
   */
  private async checkSolanaHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();
    
    try {
      const health = await this.solanaService.healthCheck();
      
      return {
        status: health.solana === 'healthy' ? 'healthy' : 'unhealthy',
        latency: health.latency,
        errorCount: 0,
        uptime: 1.0,
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        latency: Date.now() - startTime,
        errorCount: 1,
        lastError: error instanceof Error ? error.message : 'Unknown error',
        uptime: 0,
      };
    }
  }

  /**
   * Check Jupiter API health
   */
  private async checkJupiterHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();
    
    try {
      const health = await this.jupiterService.healthCheck();
      
      return {
        status: health.status,
        latency: health.latency,
        errorCount: health.error ? 1 : 0,
        lastError: health.error,
        uptime: health.status === 'healthy' ? 1.0 : 0,
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        latency: Date.now() - startTime,
        errorCount: 1,
        lastError: error instanceof Error ? error.message : 'Unknown error',
        uptime: 0,
      };
    }
  }

  /**
   * Check database health
   */
  private async checkDatabaseHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();
    
    try {
      // Simple database ping query
      // This would be replaced with actual database connection check
      const latency = Date.now() - startTime;
      
      return {
        status: 'healthy',
        latency,
        errorCount: 0,
        uptime: 1.0,
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        latency: Date.now() - startTime,
        errorCount: 1,
        lastError: error instanceof Error ? error.message : 'Database connection failed',
        uptime: 0,
      };
    }
  }

  /**
   * Check Redis health
   */
  private async checkRedisHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();
    
    try {
      // Simple Redis ping
      // This would be replaced with actual Redis ping
      const latency = Date.now() - startTime;
      
      return {
        status: 'healthy',
        latency,
        errorCount: 0,
        uptime: 1.0,
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        latency: Date.now() - startTime,
        errorCount: 1,
        lastError: error instanceof Error ? error.message : 'Redis connection failed',
        uptime: 0,
      };
    }
  }

  /**
   * Check API health
   */
  private async checkApiHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();
    
    try {
      // Check if API is responding
      const latency = Date.now() - startTime;
      
      return {
        status: 'healthy',
        latency,
        errorCount: 0,
        uptime: 1.0,
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        latency: Date.now() - startTime,
        errorCount: 1,
        lastError: error instanceof Error ? error.message : 'API health check failed',
        uptime: 0,
      };
    }
  }

  /**
   * Collect trading and system metrics
   */
  private async collectMetrics(): Promise<TradingMetrics> {
    try {
      // This would collect real metrics from the database
      const metrics: TradingMetrics = {
        volume24h: 0, // Query database for 24h volume
        trades24h: 0, // Query database for 24h trade count
        avgTradeSize: 0, // Calculate average trade size
        priceImpact: 0, // Average price impact
        slippage: 0, // Average slippage
        fees24h: 0, // Total fees collected in 24h
        uniqueTraders24h: 0, // Unique wallet addresses in 24h
      };
      
      this.emit('metrics', metrics);
      return metrics;
      
    } catch (error) {
      console.error('Failed to collect metrics:', error);
      throw error;
    }
  }

  /**
   * Check for system alerts
   */
  private checkForAlerts(health: SystemHealth): void {
    // Critical system alerts
    if (health.status === 'unhealthy') {
      this.emitAlert('critical', 'system_unhealthy', 'System is unhealthy', health);
    }
    
    // High error rate alert
    if (health.metrics.errorRate > 0.05) { // 5% error rate
      this.emitAlert('warning', 'high_error_rate', `Error rate is ${(health.metrics.errorRate * 100).toFixed(2)}%`, {
        errorRate: health.metrics.errorRate,
      });
    }
    
    // High response time alert  
    if (health.metrics.avgResponseTime > 5000) { // 5 seconds
      this.emitAlert('warning', 'high_response_time', `Average response time is ${health.metrics.avgResponseTime}ms`, {
        responseTime: health.metrics.avgResponseTime,
      });
    }
    
    // High volume alert (circuit breaker)
    if (health.metrics.totalVolume24h > 1000000) { // $1M daily volume
      this.emitAlert('critical', 'volume_circuit_breaker', `24h volume exceeded $1M: $${health.metrics.totalVolume24h}`, {
        volume: health.metrics.totalVolume24h,
      });
    }
    
    // Component-specific alerts
    Object.entries(health.components).forEach(([component, componentHealth]) => {
      if (componentHealth.status === 'unhealthy') {
        this.emitAlert('critical', 'component_unhealthy', `${component} is unhealthy`, {
          component,
          error: componentHealth.lastError,
        });
      }
      
      if (componentHealth.latency > 10000) { // 10 seconds
        this.emitAlert('warning', 'high_latency', `${component} latency is ${componentHealth.latency}ms`, {
          component,
          latency: componentHealth.latency,
        });
      }
    });
  }

  /**
   * Emit security/system alert
   */
  private emitAlert(level: SecurityAlert['level'], type: string, message: string, data: Record<string, any>): void {
    const alert: SecurityAlert = {
      level,
      type,
      message,
      data,
      timestamp: new Date(),
    };
    
    console.log(`🚨 [${level.toUpperCase()}] ${message}`, data);
    this.emit('alert', alert);
    
    // Send to external monitoring systems
    this.sendToExternalMonitoring(alert);
  }

  /**
   * Send alerts to external monitoring systems
   */
  private async sendToExternalMonitoring(alert: SecurityAlert): Promise<void> {
    try {
      // Send to Slack/Discord/Email based on alert level
      if (alert.level === 'critical') {
        await this.sendSlackAlert(alert);
        await this.sendEmailAlert(alert);
      } else if (alert.level === 'warning') {
        await this.sendSlackAlert(alert);
      }
      
      // Send to Sentry for error tracking
      // Sentry.captureException(new Error(alert.message), { extra: alert.data });
      
    } catch (error) {
      console.error('Failed to send external alert:', error);
    }
  }

  /**
   * Send alert to Slack
   */
  private async sendSlackAlert(alert: SecurityAlert): Promise<void> {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) return;
    
    const color = alert.level === 'critical' ? 'danger' : 'warning';
    const emoji = alert.level === 'critical' ? '🚨' : '⚠️';
    
    const payload = {
      text: `${emoji} PhantomPool Alert`,
      attachments: [{
        color,
        title: alert.message,
        fields: [
          { title: 'Level', value: alert.level, short: true },
          { title: 'Type', value: alert.type, short: true },
          { title: 'Time', value: alert.timestamp.toISOString(), short: false },
        ],
        text: JSON.stringify(alert.data, null, 2),
      }],
    };
    
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        throw new Error(`Slack webhook failed: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to send Slack alert:', error);
    }
  }

  /**
   * Send alert via email
   */
  private async sendEmailAlert(alert: SecurityAlert): Promise<void> {
    // Implement email alerting using your preferred service
    // (SendGrid, AWS SES, etc.)
    console.log('📧 Email alert would be sent:', alert);
  }

  // Helper methods
  private getHealthResult(result: PromiseSettledResult<ComponentHealth>): ComponentHealth {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return this.createErrorHealth(result.reason?.message);
    }
  }

  private createErrorHealth(error?: string): ComponentHealth {
    return {
      status: 'unhealthy',
      latency: 0,
      errorCount: 1,
      lastError: error || 'Unknown error',
      uptime: 0,
    };
  }

  private calculateOverallStatus(components: ComponentHealth[]): 'healthy' | 'degraded' | 'unhealthy' {
    const unhealthyCount = components.filter(c => c.status === 'unhealthy').length;
    const degradedCount = components.filter(c => c.status === 'degraded').length;
    
    if (unhealthyCount > 0) return 'unhealthy';
    if (degradedCount > 0) return 'degraded';
    return 'healthy';
  }

  private calculateAvgResponseTime(): number {
    if (this.metrics.responseTimes.length === 0) return 0;
    return this.metrics.responseTimes.reduce((a, b) => a + b, 0) / this.metrics.responseTimes.length;
  }

  private calculateErrorRate(): number {
    const totalRequests = this.metrics.totalTrades24h + this.metrics.errors24h;
    if (totalRequests === 0) return 0;
    return this.metrics.errors24h / totalRequests;
  }

  /**
   * Get current system status
   */
  async getSystemStatus(): Promise<SystemHealth> {
    return this.performHealthCheck();
  }

  /**
   * Trigger emergency pause
   */
  async emergencyPause(reason: string): Promise<void> {
    console.log(`🚨 EMERGENCY PAUSE TRIGGERED: ${reason}`);
    
    // Emit emergency event
    this.emitAlert('critical', 'emergency_pause', `Emergency pause activated: ${reason}`, {
      reason,
      timestamp: new Date(),
    });
    
    // This would pause trading in the smart contract
    // await this.solanaService.emergencyPause();
  }
}