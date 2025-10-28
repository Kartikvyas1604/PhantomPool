'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Shield, Lock, TrendingUp, Eye, Users, Clock, CheckCircle, 
  AlertCircle, Shuffle, Layers, Activity, BarChart3, Cpu, Database, Network
} from 'lucide-react';

import AdvancedTradingForm from '@/components/AdvancedTradingForm';
import RealTimePriceChart from '@/components/RealTimePriceChart';
import { WalletConnection } from '@/components/WalletConnection';
import { useRealTimeData } from '@/hooks/useRealTimeData';
import { useSystemMonitoring } from '@/hooks/useSystemMonitoring';

interface MatchingStatus {
  isMatching: boolean;
  nextRoundIn: number;
  matchingInterval: number;
  totalOrders: {
    buy: number;
    sell: number;
  };
}

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: {
    redis: boolean;
    crypto: boolean;
    matching: boolean;
  };
  activeConnections: number;
  uptime: number;
}

export default function PhantomPoolDashboard() {
  const { marketData, loading: priceLoading } = useRealTimeData();
  const { 
    healthData: systemHealth, 
    matchingStatus, 
    wsConnected, 
    loading: systemLoading
  } = useSystemMonitoring();

  const [recentTrades, setRecentTrades] = useState<any[]>([]);
  
  const currentPrice = marketData?.sol?.price || 0;
  const volume24h = marketData?.sol?.volume24h || 0;
  const priceChange = marketData?.sol?.change24h || 0;

  useEffect(() => {
    const setupWebSocket = () => {
      try {
        const ws = new WebSocket('ws://localhost:3001/ws');
        
        ws.onmessage = (event) => {
          const message = JSON.parse(event.data);
          if (message.type === 'matching_completed') {
            setRecentTrades(prev => [message.data, ...prev.slice(0, 9)]);
          }
        };

        return ws;
      } catch (error) {
        return null;
      }
    };

    const ws = setupWebSocket();
    return () => ws?.close();
  }, []);

  const LoadingCard = ({ children }: { children?: React.ReactNode }) => (
    <div className="animate-pulse bg-gray-700 h-8 w-20 rounded">{children}</div>
  );

  const StatusIndicator = ({ status }: { status: string }) => (
    <div className={`w-2 h-2 rounded-full ${
      status === 'healthy' ? 'bg-green-400' : 
      status === 'degraded' ? 'bg-yellow-400' : 'bg-red-400'
    }`} />
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
      {/* Header */}
      <header className="border-b border-gray-800 bg-black/20 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">PhantomPool</h1>
                <p className="text-sm text-gray-400">Advanced Dark Pool Trading</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <StatusIndicator status={wsConnected ? 'healthy' : 'unhealthy'} />
                <span className="text-sm text-gray-400">
                  {wsConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              <WalletConnection />
              <Badge variant={systemHealth?.status === 'healthy' ? 'default' : 'destructive'}>
                <CheckCircle className="w-3 h-3 mr-1" />
                {systemHealth?.status?.toUpperCase() || 'LOADING'}
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Hero Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-black/40 border-gray-800 text-white">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-400">SOL Price</CardTitle>
                <TrendingUp className="w-4 h-4 text-green-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {priceLoading ? <LoadingCard /> : `$${currentPrice.toFixed(2)}`}
              </div>
              <p className={`text-xs mt-1 ${priceChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {priceLoading ? <LoadingCard /> : `${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}% (24h)`}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-black/40 border-gray-800 text-white">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-400">24h Volume</CardTitle>
                <BarChart3 className="w-4 h-4 text-blue-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {priceLoading ? <LoadingCard /> : 
                  volume24h > 1000000 ? `$${(volume24h / 1000000).toFixed(1)}M` : `$${(volume24h / 1000).toFixed(0)}K`
                }
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {priceLoading ? <LoadingCard /> : "Real-time volume"}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-black/40 border-gray-800 text-white">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-400">Active Orders</CardTitle>
                <Users className="w-4 h-4 text-purple-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {systemLoading ? <LoadingCard /> : 
                  (matchingStatus?.totalOrders?.buy || 0) + (matchingStatus?.totalOrders?.sell || 0)
                }
              </div>
              <p className="text-xs text-purple-400 mt-1">
                {systemLoading ? <LoadingCard /> : 
                  `${matchingStatus?.totalOrders?.buy || 0} buys, ${matchingStatus?.totalOrders?.sell || 0} sells`
                }
              </p>
            </CardContent>
          </Card>

          <Card className="bg-black/40 border-gray-800 text-white">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-400">Next Round</CardTitle>
                <Clock className="w-4 h-4 text-orange-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {systemLoading ? <LoadingCard /> : `${matchingStatus?.nextRoundIn || 30}s`}
              </div>
              {!systemLoading && (
                <Progress 
                  value={(30 - (matchingStatus?.nextRoundIn || 30)) / 30 * 100}
                  className="mt-2"
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Trading Interface */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Privacy Features */}
          <div className="space-y-4">
            <Card className="bg-black/40 border-gray-800 text-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="w-5 h-5 text-blue-400" />
                  Privacy Protection
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Advanced cryptographic privacy systems
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {[
                    { icon: Layers, label: 'ElGamal Encryption', color: 'text-green-400' },
                    { icon: Shuffle, label: 'VRF Fair Shuffling', color: 'text-purple-400' },
                    { icon: Shield, label: 'Zero-Knowledge Proofs', color: 'text-blue-400' },
                    { icon: Eye, label: 'Bulletproof Solvency', color: 'text-orange-400' }
                  ].map(({ icon: Icon, label, color }) => (
                    <div key={label} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${color}`} />
                        <span className="text-sm">{label}</span>
                      </div>
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    </div>
                  ))}
                </div>

                <Separator className="bg-gray-700" />

                <Alert className="bg-green-950/30 border-green-800">
                  <Shield className="h-4 w-4" />
                  <AlertDescription className="text-green-200">
                    All orders are encrypted end-to-end. Your trading activity is completely private.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* System Health */}
            <Card className="bg-black/40 border-gray-800 text-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-green-400" />
                  System Health
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {systemLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} className="flex items-center justify-between">
                        <LoadingCard />
                        <LoadingCard />
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    {[
                      { key: 'redis', label: 'Redis Cache' },
                      { key: 'crypto', label: 'Cryptography' },
                      { key: 'matching', label: 'Matching Engine' },
                      { key: 'api', label: 'API Server' },
                      { key: 'database', label: 'Database' }
                    ].map(({ key, label }) => (
                      <div key={key} className="flex items-center justify-between">
                        <span className="text-sm">{label}</span>
                        <Badge variant={systemHealth?.services?.[key as keyof typeof systemHealth.services] ? 'default' : 'destructive'}>
                          {systemHealth?.services?.[key as keyof typeof systemHealth.services] ? 'Healthy' : 'Down'}
                        </Badge>
                      </div>
                    ))}

                    <Separator className="bg-gray-700" />

                    <div className="text-xs text-gray-400">
                      Uptime: {systemHealth?.uptime ? 
                        `${Math.floor((Date.now() - systemHealth.uptime) / 3600000)}h ${Math.floor(((Date.now() - systemHealth.uptime) % 3600000) / 60000)}m` : 
                        'Unknown'
                      }
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Center Panel - Advanced Trading Form */}
          <AdvancedTradingForm />

          {/* Right Panel - Price Chart & Analytics */}
          <div className="space-y-4">
            <RealTimePriceChart />

            <Card className="bg-black/40 border-gray-800 text-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-orange-400" />
                  Matching Engine
                </CardTitle>
                <CardDescription className="text-gray-400">
                  30-second batched matching rounds
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {systemLoading ? (
                  <div className="space-y-4">
                    <LoadingCard />
                    <div className="space-y-3">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="flex justify-between">
                          <LoadingCard />
                          <LoadingCard />
                        </div>
                      ))}
                    </div>
                    <div className="animate-pulse bg-gray-700 h-2 rounded" />
                  </div>
                ) : (
                  <>
                    <Alert className={matchingStatus?.isMatching ? 
                      "bg-orange-950/30 border-orange-800" : 
                      "bg-blue-950/30 border-blue-800"
                    }>
                      {matchingStatus?.isMatching ? <AlertCircle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                      <AlertDescription className={matchingStatus?.isMatching ? "text-orange-200" : "text-blue-200"}>
                        {matchingStatus?.isMatching ? 
                          "Matching round in progress..." : 
                          `Next round in ${matchingStatus?.nextRoundIn || 30} seconds`
                        }
                      </AlertDescription>
                    </Alert>

                    <div className="space-y-3">
                      {[
                        { label: 'Round Interval', value: `${matchingStatus?.matchingInterval || 30}s` },
                        { label: 'Pending Buy Orders', value: matchingStatus?.totalOrders?.buy || 0, color: 'text-green-400' },
                        { label: 'Pending Sell Orders', value: matchingStatus?.totalOrders?.sell || 0, color: 'text-red-400' }
                      ].map(({ label, value, color }) => (
                        <div key={label} className="flex justify-between text-sm">
                          <span className="text-gray-400">{label}</span>
                          <span className={color || 'text-white'}>{value}</span>
                        </div>
                      ))}
                    </div>

                    <Progress 
                      value={(30 - (matchingStatus?.nextRoundIn || 30)) / 30 * 100} 
                      className="h-2"
                    />
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="bg-black/40 border-gray-800 text-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-green-400" />
                  Recent Trades
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recentTrades.length > 0 ? (
                  <div className="space-y-2">
                    {recentTrades.slice(0, 5).map((trade, index) => (
                      <div key={index} className="flex justify-between items-center py-2 border-b border-gray-800 last:border-b-0">
                        <div className="text-sm">
                          <div className="text-white">${trade.clearingPrice}</div>
                          <div className="text-gray-400 text-xs">{trade.matchedCount} trades</div>
                        </div>
                        <div className="text-right text-sm">
                          <div className="text-green-400">+{trade.totalVolume?.toFixed(2)}</div>
                          <div className="text-gray-400 text-xs">SOL</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No recent trades</p>
                    <p className="text-sm">Waiting for matching rounds...</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Footer Info */}
        <Card className="bg-black/40 border-gray-800 text-white">
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4 text-sm text-gray-400">
                {[
                  { icon: Network, label: '5 Executor Nodes' },
                  { icon: Database, label: 'Redis Cache' },
                  { icon: Shield, label: '3-of-5 Threshold' }
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-1">
                    <Icon className="w-4 h-4" />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
              
              <div className="text-sm text-gray-400">
                PhantomPool v1.0.0-production | Zero-loss guarantees active
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
