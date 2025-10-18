'use client';

import { useState, useEffect } from 'react';
import { 
  Activity, 
  Database, 
  Wifi, 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  BarChart3,
  Users,
  Zap,
  TrendingUp,
  Server,
  Eye,
  Download,
  RefreshCw
} from 'lucide-react';
import { motion } from 'motion/react';

interface SystemMetrics {
  server: {
    status: string;
    uptime: number;
    requests: number;
    errors: number;
    error_rate: string;
  };
  websocket: {
    connected_clients: number;
    total_connections: number;
    messages_sent: number;
    messages_received: number;
    channels: Record<string, { subscribers: number; messages: number }>;
  };
  orders: {
    total: number;
    active: number;
    filled: number;
    cancelled: number;
    average_size: number;
  };
  trades: {
    total: number;
    volume: number;
    average_size: number;
  };
  crypto: {
    bulletproofGenerated: number;
    elgamalEncryptions: number;
    vrfGenerations: number;
    thresholdSignatures: number;
  };
  performance: {
    memory_mb: number;
    avg_response_time: number;
    slow_queries: number;
  };
  security: {
    failedAuthentications: number;
    rateLimitHits: number;
    suspiciousActivity: number;
  };
  alerts: {
    total: number;
    unresolved: number;
    recent: any[];
  };
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  data?: any;
}

export function SystemMonitoringDashboard() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'metrics' | 'logs' | 'alerts'>('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchDashboardData = async () => {
    try {
      const [dashboardResponse, logsResponse, alertsResponse] = await Promise.all([
        fetch('/api/admin/dashboard'),
        fetch('/api/admin/logs?limit=50'),
        fetch('/api/admin/alerts?limit=20')
      ]);

      if (dashboardResponse.ok) {
        const dashboardData = await dashboardResponse.json();
        setMetrics(dashboardData.data);
      }

      if (logsResponse.ok) {
        const logsData = await logsResponse.json();
        setLogs(logsData.data.logs.map((log: string) => {
          // Parse log format: [timestamp] LEVEL | message | meta
          const match = log.match(/\[(.*?)\]\s+(\w+)\s+\|\s+(.*?)(?:\s+\|\s+(.*))?$/);
          if (match) {
            return {
              timestamp: match[1],
              level: match[2],
              message: match[3],
              data: match[4] ? match[4] : undefined
            };
          }
          return {
            timestamp: new Date().toISOString(),
            level: 'INFO',
            message: log,
            data: undefined
          };
        }));
      }

      if (alertsResponse.ok) {
        const alertsData = await alertsResponse.json();
        setAlerts(alertsData.data.alerts);
      }

      setLastUpdate(new Date());
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    let interval: NodeJS.Timeout | null = null;
    if (autoRefresh) {
      interval = setInterval(fetchDashboardData, 10000); // Update every 10 seconds
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}h ${minutes}m ${secs}s`;
  };

  const formatBytes = (bytes: number) => {
    return bytes ? `${bytes} MB` : '0 MB';
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'healthy': return 'text-green-400';
      case 'warning': return 'text-yellow-400';
      case 'critical': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'healthy': return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
      case 'critical': return <AlertTriangle className="w-5 h-5 text-red-400" />;
      default: return <Activity className="w-5 h-5 text-gray-400" />;
    }
  };

  const getLevelColor = (level: string) => {
    switch (level.toUpperCase()) {
      case 'ERROR': return 'text-red-400 bg-red-900/20';
      case 'WARN': return 'text-yellow-400 bg-yellow-900/20';
      case 'INFO': return 'text-blue-400 bg-blue-900/20';
      case 'DEBUG': return 'text-gray-400 bg-gray-900/20';
      default: return 'text-gray-400 bg-gray-900/20';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0118] to-[#1a0b2e] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white">Loading monitoring dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0118] to-[#1a0b2e] p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">System Monitoring</h1>
              <p className="text-gray-400">PhantomPool Real-time Dashboard</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-400">
                Last updated: {lastUpdate.toLocaleTimeString()}
              </div>
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                  autoRefresh 
                    ? 'bg-green-900/20 border-green-500/30 text-green-400' 
                    : 'bg-gray-900/20 border-gray-500/30 text-gray-400'
                }`}
              >
                <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
                Auto Refresh
              </button>
              <button
                onClick={fetchDashboardData}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cyan-900/20 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-800/20 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh Now
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 mb-6 bg-white/5 backdrop-blur-md rounded-lg p-1">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'metrics', label: 'Detailed Metrics', icon: Activity },
            { id: 'logs', label: 'System Logs', icon: Eye },
            { id: 'alerts', label: 'Alerts', icon: AlertTriangle }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 ${
                selectedTab === tab.id
                  ? 'bg-cyan-600 text-white shadow-lg'
                  : 'text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.id === 'alerts' && alerts.filter(a => !a.resolved).length > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {alerts.filter(a => !a.resolved).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {selectedTab === 'overview' && metrics && (
          <div className="space-y-6">
            {/* Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/5 backdrop-blur-md rounded-lg p-6 border border-cyan-500/20"
              >
                <div className="flex items-center gap-3 mb-4">
                  {getStatusIcon(metrics.server.status)}
                  <h3 className="font-semibold text-white">System Health</h3>
                </div>
                <div className={`text-2xl font-bold mb-2 ${getStatusColor(metrics.server.status)}`}>
                  {metrics.server.status.toUpperCase()}
                </div>
                <p className="text-gray-400 text-sm">
                  Uptime: {formatUptime(metrics.server.uptime)}
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white/5 backdrop-blur-md rounded-lg p-6 border border-cyan-500/20"
              >
                <div className="flex items-center gap-3 mb-4">
                  <Wifi className="w-5 h-5 text-blue-400" />
                  <h3 className="font-semibold text-white">WebSocket</h3>
                </div>
                <div className="text-2xl font-bold text-blue-400 mb-2">
                  {metrics.websocket.connected_clients}
                </div>
                <p className="text-gray-400 text-sm">Connected Clients</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white/5 backdrop-blur-md rounded-lg p-6 border border-cyan-500/20"
              >
                <div className="flex items-center gap-3 mb-4">
                  <TrendingUp className="w-5 h-5 text-green-400" />
                  <h3 className="font-semibold text-white">Trading Volume</h3>
                </div>
                <div className="text-2xl font-bold text-green-400 mb-2">
                  ${metrics.trades.volume.toFixed(2)}
                </div>
                <p className="text-gray-400 text-sm">{metrics.trades.total} Trades</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-white/5 backdrop-blur-md rounded-lg p-6 border border-cyan-500/20"
              >
                <div className="flex items-center gap-3 mb-4">
                  <Shield className="w-5 h-5 text-purple-400" />
                  <h3 className="font-semibold text-white">Security</h3>
                </div>
                <div className="text-2xl font-bold text-purple-400 mb-2">
                  {metrics.crypto.elgamalEncryptions}
                </div>
                <p className="text-gray-400 text-sm">Encrypted Orders</p>
              </motion.div>
            </div>

            {/* Detailed Metrics Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Orders & Trades */}
              <div className="bg-white/5 backdrop-blur-md rounded-lg p-6 border border-cyan-500/20">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Database className="w-5 h-5 text-cyan-400" />
                  Trading Activity
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-400 text-sm">Total Orders</p>
                    <p className="text-xl font-bold text-white">{metrics.orders.total}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Active Orders</p>
                    <p className="text-xl font-bold text-yellow-400">{metrics.orders.active}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Filled Orders</p>
                    <p className="text-xl font-bold text-green-400">{metrics.orders.filled}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Avg Order Size</p>
                    <p className="text-xl font-bold text-white">{metrics.orders.average_size.toFixed(4)}</p>
                  </div>
                </div>
              </div>

              {/* Performance */}
              <div className="bg-white/5 backdrop-blur-md rounded-lg p-6 border border-cyan-500/20">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Server className="w-5 h-5 text-green-400" />
                  Performance
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-400 text-sm">Memory Usage</p>
                    <p className="text-xl font-bold text-white">{formatBytes(metrics.performance.memory_mb)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Avg Response</p>
                    <p className="text-xl font-bold text-blue-400">{metrics.performance.avg_response_time}ms</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Error Rate</p>
                    <p className="text-xl font-bold text-red-400">{metrics.server.error_rate}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Slow Queries</p>
                    <p className="text-xl font-bold text-yellow-400">{metrics.performance.slow_queries}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* WebSocket Channels */}
            <div className="bg-white/5 backdrop-blur-md rounded-lg p-6 border border-cyan-500/20">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Wifi className="w-5 h-5 text-blue-400" />
                WebSocket Channels
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {Object.entries(metrics.websocket.channels).map(([channel, stats]) => (
                  <div key={channel} className="text-center">
                    <p className="text-gray-400 text-sm capitalize">{channel}</p>
                    <p className="text-lg font-bold text-white">{stats.subscribers}</p>
                    <p className="text-xs text-gray-500">{stats.messages} msgs</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {selectedTab === 'logs' && (
          <div className="bg-white/5 backdrop-blur-md rounded-lg border border-cyan-500/20">
            <div className="p-4 border-b border-cyan-500/20">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Eye className="w-5 h-5 text-cyan-400" />
                System Logs
              </h3>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {logs.length > 0 ? (
                <div className="divide-y divide-gray-800">
                  {logs.map((log, index) => (
                    <div key={index} className="p-4 hover:bg-white/5 transition-colors">
                      <div className="flex items-start gap-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getLevelColor(log.level)}`}>
                          {log.level}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm">{log.message}</p>
                          <div className="flex items-center gap-4 mt-1">
                            <p className="text-gray-400 text-xs">
                              {new Date(log.timestamp).toLocaleString()}
                            </p>
                            {log.data && (
                              <p className="text-gray-500 text-xs font-mono">
                                {log.data}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-gray-400">
                  No logs available
                </div>
              )}
            </div>
          </div>
        )}

        {selectedTab === 'alerts' && (
          <div className="bg-white/5 backdrop-blur-md rounded-lg border border-cyan-500/20">
            <div className="p-4 border-b border-cyan-500/20">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-400" />
                System Alerts
              </h3>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {alerts.length > 0 ? (
                <div className="divide-y divide-gray-800">
                  {alerts.map((alert, index) => (
                    <div key={alert.id || index} className="p-4 hover:bg-white/5 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className={`w-2 h-2 rounded-full mt-2 ${
                          alert.severity === 'ERROR' ? 'bg-red-400' :
                          alert.severity === 'WARNING' ? 'bg-yellow-400' :
                          'bg-blue-400'
                        }`} />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="text-white font-medium">{alert.message}</p>
                            {!alert.resolved && (
                              <span className="bg-red-500/20 text-red-400 text-xs px-2 py-1 rounded">
                                Active
                              </span>
                            )}
                          </div>
                          <p className="text-gray-400 text-sm mt-1">
                            {new Date(alert.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-gray-400">
                  No alerts
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}