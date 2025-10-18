/**
 * PhantomPool System Metrics and Monitoring Service
 * Comprehensive metrics collection, logging, and health monitoring
 */

const fs = require('fs');
const path = require('path');

class PhantomPoolMetricsService {
  constructor() {
    this.metrics = {
      // Server Metrics
      server: {
        startTime: Date.now(),
        uptime: 0,
        requestCount: 0,
        errorCount: 0,
        activeConnections: 0,
        totalConnections: 0
      },
      
      // WebSocket Metrics
      websocket: {
        connectedClients: 0,
        totalConnections: 0,
        disconnections: 0,
        messagesSent: 0,
        messagesReceived: 0,
        authenticationCount: 0,
        subscriptionCount: 0,
        broadcastCount: 0,
        channelStats: {
          orders: { subscribers: 0, messages: 0 },
          trades: { subscribers: 0, messages: 0 },
          orderbook: { subscribers: 0, messages: 0 },
          system: { subscribers: 0, messages: 0 },
          portfolio: { subscribers: 0, messages: 0 }
        }
      },
      
      // Trading Metrics
      trading: {
        totalOrders: 0,
        activeOrders: 0,
        filledOrders: 0,
        cancelledOrders: 0,
        totalTrades: 0,
        totalVolume: 0,
        averageOrderSize: 0,
        averageTradeSize: 0,
        orderTypes: {
          buy: 0,
          sell: 0
        },
        orderStatus: {
          pending: 0,
          partial: 0,
          filled: 0,
          cancelled: 0,
          rejected: 0
        }
      },
      
      // Crypto Services Metrics
      crypto: {
        bulletproofGenerated: 0,
        bulletproofVerified: 0,
        elgamalEncryptions: 0,
        elgamalDecryptions: 0,
        vrfGenerations: 0,
        vrfVerifications: 0,
        thresholdSignatures: 0,
        thresholdDecryptions: 0
      },
      
      // Performance Metrics
      performance: {
        averageResponseTime: 0,
        slowQueries: 0,
        memoryUsage: {
          rss: 0,
          heapTotal: 0,
          heapUsed: 0,
          external: 0
        },
        cpuUsage: {
          user: 0,
          system: 0
        }
      },
      
      // Security Metrics
      security: {
        failedAuthentications: 0,
        rateLimitHits: 0,
        suspiciousActivity: 0,
        blockedIPs: 0
      },
      
      // Health Status
      health: {
        status: 'starting',
        database: 'unknown',
        websocket: 'unknown',
        crypto: 'unknown',
        apis: 'unknown',
        lastHealthCheck: Date.now()
      }
    };
    
    this.logs = [];
    this.maxLogs = 10000;
    this.alerts = [];
    this.maxAlerts = 1000;
    
    // Performance tracking
    this.responseTimeWindow = [];
    this.maxResponseTimeWindow = 1000;
    
    // Update intervals
    this.updateInterval = null;
    this.logInterval = null;
    
    this.initializeMetrics();
  }

  initializeMetrics() {
    // Update uptime and performance metrics every second
    this.updateInterval = setInterval(() => {
      this.updateSystemMetrics();
    }, 1000);

    // Log metrics every 30 seconds
    this.logInterval = setInterval(() => {
      this.logMetrics();
    }, 30000);

    this.log('info', 'Metrics service initialized', { service: 'metrics' });
  }

  updateSystemMetrics() {
    // Update uptime
    this.metrics.server.uptime = Math.floor((Date.now() - this.metrics.server.startTime) / 1000);
    
    // Update memory usage
    const memUsage = process.memoryUsage();
    this.metrics.performance.memoryUsage = {
      rss: Math.round(memUsage.rss / 1024 / 1024), // MB
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024)
    };
    
    // Update CPU usage
    const cpuUsage = process.cpuUsage();
    this.metrics.performance.cpuUsage = {
      user: Math.round(cpuUsage.user / 1000), // microseconds to milliseconds
      system: Math.round(cpuUsage.system / 1000)
    };
    
    // Calculate average response time
    if (this.responseTimeWindow.length > 0) {
      const sum = this.responseTimeWindow.reduce((a, b) => a + b, 0);
      this.metrics.performance.averageResponseTime = Math.round(sum / this.responseTimeWindow.length);
    }
    
    // Update health status
    this.updateHealthStatus();
  }

  updateHealthStatus() {
    const health = this.metrics.health;
    const now = Date.now();
    
    // Overall system health based on various factors
    let healthScore = 100;
    
    // Check memory usage (red flag if > 80% heap used)
    const heapUsagePercent = (this.metrics.performance.memoryUsage.heapUsed / this.metrics.performance.memoryUsage.heapTotal) * 100;
    if (heapUsagePercent > 80) healthScore -= 20;
    
    // Check error rate (red flag if error rate > 5%)
    const errorRate = this.metrics.server.requestCount > 0 ? (this.metrics.server.errorCount / this.metrics.server.requestCount) * 100 : 0;
    if (errorRate > 5) healthScore -= 30;
    
    // Check WebSocket health
    if (this.metrics.websocket.connectedClients === 0 && this.metrics.server.uptime > 60) {
      healthScore -= 10; // Minor issue if no clients after 1 minute
    }
    
    // Determine health status
    if (healthScore >= 90) {
      health.status = 'healthy';
    } else if (healthScore >= 70) {
      health.status = 'warning';
    } else {
      health.status = 'critical';
    }
    
    health.lastHealthCheck = now;
  }

  // Metric tracking methods
  incrementRequestCount() {
    this.metrics.server.requestCount++;
  }

  incrementErrorCount() {
    this.metrics.server.errorCount++;
  }

  trackResponseTime(responseTime) {
    this.responseTimeWindow.push(responseTime);
    if (this.responseTimeWindow.length > this.maxResponseTimeWindow) {
      this.responseTimeWindow.shift();
    }
    
    if (responseTime > 5000) { // 5 seconds
      this.metrics.performance.slowQueries++;
      this.alert('warning', 'Slow response detected', { responseTime, endpoint: 'unknown' });
    }
  }

  // WebSocket metrics
  incrementWebSocketConnection() {
    this.metrics.websocket.connectedClients++;
    this.metrics.websocket.totalConnections++;
  }

  decrementWebSocketConnection() {
    this.metrics.websocket.connectedClients = Math.max(0, this.metrics.websocket.connectedClients - 1);
    this.metrics.websocket.disconnections++;
  }

  incrementWebSocketMessage(type = 'unknown') {
    this.metrics.websocket.messagesReceived++;
    
    if (type === 'auth') {
      this.metrics.websocket.authenticationCount++;
    } else if (type === 'subscribe') {
      this.metrics.websocket.subscriptionCount++;
    }
  }

  incrementWebSocketBroadcast(channel = 'unknown') {
    this.metrics.websocket.messagesSent++;
    this.metrics.websocket.broadcastCount++;
    
    if (this.metrics.websocket.channelStats[channel]) {
      this.metrics.websocket.channelStats[channel].messages++;
    }
  }

  updateChannelSubscribers(channel, count) {
    if (this.metrics.websocket.channelStats[channel]) {
      this.metrics.websocket.channelStats[channel].subscribers = count;
    }
  }

  // Trading metrics
  recordOrder(order) {
    this.metrics.trading.totalOrders++;
    this.metrics.trading.orderTypes[order.type] = (this.metrics.trading.orderTypes[order.type] || 0) + 1;
    this.metrics.trading.orderStatus[order.status || 'pending'] = (this.metrics.trading.orderStatus[order.status || 'pending'] || 0) + 1;
    
    // Update active orders count
    if (['pending', 'partial', 'open'].includes(order.status || 'pending')) {
      this.metrics.trading.activeOrders++;
    }
    
    const amount = parseFloat(order.amount) || 0;
    this.updateAverageOrderSize(amount);
  }

  recordOrderStatusChange(oldStatus, newStatus) {
    if (oldStatus && this.metrics.trading.orderStatus[oldStatus] > 0) {
      this.metrics.trading.orderStatus[oldStatus]--;
    }
    
    this.metrics.trading.orderStatus[newStatus] = (this.metrics.trading.orderStatus[newStatus] || 0) + 1;
    
    // Update counters
    if (['pending', 'partial', 'open'].includes(oldStatus) && !['pending', 'partial', 'open'].includes(newStatus)) {
      this.metrics.trading.activeOrders = Math.max(0, this.metrics.trading.activeOrders - 1);
    }
    
    if (newStatus === 'filled') {
      this.metrics.trading.filledOrders++;
    } else if (newStatus === 'cancelled') {
      this.metrics.trading.cancelledOrders++;
    }
  }

  recordTrade(trade) {
    this.metrics.trading.totalTrades++;
    
    const amount = parseFloat(trade.amount) || 0;
    const price = parseFloat(trade.price) || 0;
    const volume = amount * price;
    
    this.metrics.trading.totalVolume += volume;
    this.updateAverageTradeSize(amount);
  }

  updateAverageOrderSize(newOrderSize) {
    const currentAvg = this.metrics.trading.averageOrderSize;
    const totalOrders = this.metrics.trading.totalOrders;
    
    if (totalOrders === 1) {
      this.metrics.trading.averageOrderSize = newOrderSize;
    } else {
      this.metrics.trading.averageOrderSize = ((currentAvg * (totalOrders - 1)) + newOrderSize) / totalOrders;
    }
  }

  updateAverageTradeSize(newTradeSize) {
    const currentAvg = this.metrics.trading.averageTradeSize;
    const totalTrades = this.metrics.trading.totalTrades;
    
    if (totalTrades === 1) {
      this.metrics.trading.averageTradeSize = newTradeSize;
    } else {
      this.metrics.trading.averageTradeSize = ((currentAvg * (totalTrades - 1)) + newTradeSize) / totalTrades;
    }
  }

  // Crypto service metrics
  recordCryptoOperation(operation, success = true) {
    switch (operation) {
      case 'bulletproof_generate':
        this.metrics.crypto.bulletproofGenerated++;
        break;
      case 'bulletproof_verify':
        this.metrics.crypto.bulletproofVerified++;
        break;
      case 'elgamal_encrypt':
        this.metrics.crypto.elgamalEncryptions++;
        break;
      case 'elgamal_decrypt':
        this.metrics.crypto.elgamalDecryptions++;
        break;
      case 'vrf_generate':
        this.metrics.crypto.vrfGenerations++;
        break;
      case 'vrf_verify':
        this.metrics.crypto.vrfVerifications++;
        break;
      case 'threshold_sign':
        this.metrics.crypto.thresholdSignatures++;
        break;
      case 'threshold_decrypt':
        this.metrics.crypto.thresholdDecryptions++;
        break;
    }
    
    if (!success) {
      this.alert('warning', `Crypto operation failed: ${operation}`, { operation });
    }
  }

  // Security metrics
  recordSecurityEvent(event, data = {}) {
    switch (event) {
      case 'auth_failed':
        this.metrics.security.failedAuthentications++;
        break;
      case 'rate_limit':
        this.metrics.security.rateLimitHits++;
        break;
      case 'suspicious':
        this.metrics.security.suspiciousActivity++;
        break;
      case 'ip_blocked':
        this.metrics.security.blockedIPs++;
        break;
    }
    
    this.alert('security', `Security event: ${event}`, data);
  }

  // Logging system
  log(level, message, data = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message,
      data,
      id: `log_${Date.now()}_${Math.random().toString(36).substring(7)}`
    };
    
    this.logs.unshift(logEntry);
    
    // Keep logs within limit
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }
    
    // Console output for development
    if (process.env.NODE_ENV !== 'production') {
      const emoji = this.getLogEmoji(level);
      console.log(`${emoji} [${logEntry.timestamp}] ${level.toUpperCase()}: ${message}`, data);
    }
    
    return logEntry.id;
  }

  getLogEmoji(level) {
    switch (level.toLowerCase()) {
      case 'error': return '❌';
      case 'warn': case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      case 'debug': return '🔍';
      case 'security': return '🔒';
      default: return '📝';
    }
  }

  // Alert system
  alert(severity, message, data = {}) {
    const alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      timestamp: new Date().toISOString(),
      severity: severity.toUpperCase(),
      message,
      data,
      resolved: false
    };
    
    this.alerts.unshift(alert);
    
    // Keep alerts within limit
    if (this.alerts.length > this.maxAlerts) {
      this.alerts = this.alerts.slice(0, this.maxAlerts);
    }
    
    // Log alert
    this.log(severity, `ALERT: ${message}`, data);
    
    return alert.id;
  }

  resolveAlert(alertId) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolvedAt = new Date().toISOString();
      this.log('info', `Alert resolved: ${alert.message}`, { alertId });
    }
  }

  // Data retrieval methods
  getMetrics() {
    return {
      ...this.metrics,
      timestamp: new Date().toISOString()
    };
  }

  getHealth() {
    return {
      status: this.metrics.health.status,
      uptime: this.metrics.server.uptime,
      timestamp: new Date().toISOString(),
      details: {
        server: this.metrics.server,
        websocket: {
          connected_clients: this.metrics.websocket.connectedClients,
          total_connections: this.metrics.websocket.totalConnections,
          messages_sent: this.metrics.websocket.messagesSent,
          messages_received: this.metrics.websocket.messagesReceived
        },
        trading: {
          total_orders: this.metrics.trading.totalOrders,
          active_orders: this.metrics.trading.activeOrders,
          filled_orders: this.metrics.trading.filledOrders,
          total_trades: this.metrics.trading.totalTrades,
          total_volume: Math.round(this.metrics.trading.totalVolume * 100) / 100
        },
        performance: this.metrics.performance,
        security: this.metrics.security
      }
    };
  }

  getDashboard() {
    return {
      server: {
        status: this.metrics.health.status,
        uptime: this.metrics.server.uptime,
        requests: this.metrics.server.requestCount,
        errors: this.metrics.server.errorCount,
        error_rate: this.metrics.server.requestCount > 0 ? 
          ((this.metrics.server.errorCount / this.metrics.server.requestCount) * 100).toFixed(2) + '%' : '0%'
      },
      websocket: {
        connected_clients: this.metrics.websocket.connectedClients,
        total_connections: this.metrics.websocket.totalConnections,
        messages_sent: this.metrics.websocket.messagesSent,
        messages_received: this.metrics.websocket.messagesReceived,
        channels: this.metrics.websocket.channelStats
      },
      orders: {
        total: this.metrics.trading.totalOrders,
        active: this.metrics.trading.activeOrders,
        filled: this.metrics.trading.filledOrders,
        cancelled: this.metrics.trading.cancelledOrders,
        average_size: Math.round(this.metrics.trading.averageOrderSize * 10000) / 10000
      },
      trades: {
        total: this.metrics.trading.totalTrades,
        volume: Math.round(this.metrics.trading.totalVolume * 100) / 100,
        average_size: Math.round(this.metrics.trading.averageTradeSize * 10000) / 10000
      },
      crypto: this.metrics.crypto,
      performance: {
        memory_mb: this.metrics.performance.memoryUsage.heapUsed,
        avg_response_time: this.metrics.performance.averageResponseTime,
        slow_queries: this.metrics.performance.slowQueries
      },
      security: this.metrics.security,
      alerts: {
        total: this.alerts.length,
        unresolved: this.alerts.filter(a => !a.resolved).length,
        recent: this.alerts.slice(0, 5)
      }
    };
  }

  getLogs(limit = 100, level = null) {
    let filteredLogs = this.logs;
    
    if (level) {
      filteredLogs = this.logs.filter(log => log.level.toLowerCase() === level.toLowerCase());
    }
    
    return filteredLogs.slice(0, limit);
  }

  getAlerts(resolved = null, limit = 100) {
    let filteredAlerts = this.alerts;
    
    if (resolved !== null) {
      filteredAlerts = this.alerts.filter(alert => alert.resolved === resolved);
    }
    
    return filteredAlerts.slice(0, limit);
  }

  // Periodic logging
  logMetrics() {
    const summary = {
      uptime: this.metrics.server.uptime,
      requests: this.metrics.server.requestCount,
      websocket_clients: this.metrics.websocket.connectedClients,
      orders: this.metrics.trading.totalOrders,
      trades: this.metrics.trading.totalTrades,
      memory_mb: this.metrics.performance.memoryUsage.heapUsed,
      health: this.metrics.health.status
    };
    
    this.log('info', 'Periodic metrics summary', summary);
  }

  // Cleanup
  shutdown() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    if (this.logInterval) {
      clearInterval(this.logInterval);
    }
    
    this.log('info', 'Metrics service shutting down');
  }
}

// Singleton instance
let metricsInstance = null;

function getMetricsService() {
  if (!metricsInstance) {
    metricsInstance = new PhantomPoolMetricsService();
  }
  return metricsInstance;
}

module.exports = {
  PhantomPoolMetricsService,
  getMetricsService
};