'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  TrendingDown, 
  Activity,
  BarChart3,
  Volume2,
  Clock
} from 'lucide-react';
import { useRealTimeData } from '@/hooks/useRealTimeData';

interface PricePoint {
  time: number;
  price: number;
  volume: number;
}

interface MarketData {
  currentPrice: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  trades24h: number;
}

export default function RealTimePriceChart() {
  const { marketData: realTimeData, loading, error } = useRealTimeData();
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
  const [marketData, setMarketData] = useState<MarketData>({
    currentPrice: 151.25,
    priceChange24h: 3.75,
    priceChangePercent24h: 2.54,
    volume24h: 847362.5,
    high24h: 156.80,
    low24h: 148.90,
    trades24h: 15847
  });

  // Update market data when real-time data changes
  useEffect(() => {
    if (realTimeData?.sol) {
      setMarketData({
        currentPrice: realTimeData.sol.price,
        priceChange24h: realTimeData.sol.price * (realTimeData.sol.change24h / 100),
        priceChangePercent24h: realTimeData.sol.change24h,
        volume24h: realTimeData.sol.volume24h,
        high24h: realTimeData.sol.high24h,
        low24h: realTimeData.sol.low24h,
        trades24h: Math.floor(realTimeData.sol.volume24h / 50) // Estimate trades
      });
    }
  }, [realTimeData]);

  // Generate initial price history
  useEffect(() => {
    const now = Date.now();
    const initialHistory: PricePoint[] = [];
    
    for (let i = 100; i >= 0; i--) {
      const time = now - (i * 60000); // 1 minute intervals
      const basePrice = 151.25;
      const variation = (Math.random() - 0.5) * 10;
      const price = Math.max(140, Math.min(170, basePrice + variation));
      const volume = Math.random() * 1000 + 500;
      
      initialHistory.push({ time, price, volume });
    }
    
    setPriceHistory(initialHistory);
  }, []);

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const lastPrice = priceHistory[priceHistory.length - 1]?.price || 151.25;
      const priceChange = (Math.random() - 0.5) * 2;
      const newPrice = Math.max(140, Math.min(170, lastPrice + priceChange));
      const volume = Math.random() * 1000 + 500;

      const newPoint: PricePoint = {
        time: now,
        price: newPrice,
        volume
      };

      setPriceHistory(prev => {
        const updated = [...prev, newPoint];
        return updated.slice(-100); // Keep last 100 points
      });

      // Update market data
      setMarketData(prev => ({
        ...prev,
        currentPrice: newPrice,
        priceChange24h: newPrice - 151.25,
        priceChangePercent24h: ((newPrice - 151.25) / 151.25) * 100,
        volume24h: prev.volume24h + volume,
        high24h: Math.max(prev.high24h, newPrice),
        low24h: Math.min(prev.low24h, newPrice),
        trades24h: prev.trades24h + Math.floor(Math.random() * 3) + 1
      }));
    }, 3000);

    return () => clearInterval(interval);
  }, [priceHistory]);

  // Chart dimensions and scaling
  const chartWidth = 400;
  const chartHeight = 200;
  const padding = 20;

  const { minPrice, maxPrice, maxVolume } = useMemo(() => {
    if (priceHistory.length === 0) return { minPrice: 0, maxVolume: 0, maxPrice: 0 };
    
    return {
      minPrice: Math.min(...priceHistory.map(p => p.price)),
      maxPrice: Math.max(...priceHistory.map(p => p.price)),
      maxVolume: Math.max(...priceHistory.map(p => p.volume))
    };
  }, [priceHistory]);

  // Generate SVG path for price line
  const pricePath = useMemo(() => {
    if (priceHistory.length < 2) return '';

    const points = priceHistory.map((point, index) => {
      const x = padding + (index / (priceHistory.length - 1)) * (chartWidth - 2 * padding);
      const y = padding + (1 - (point.price - minPrice) / (maxPrice - minPrice)) * (chartHeight - 2 * padding);
      return `${x},${y}`;
    });

    return `M ${points.join(' L ')}`;
  }, [priceHistory, minPrice, maxPrice, chartWidth, chartHeight, padding]);

  // Generate volume bars
  const volumeBars = useMemo(() => {
    return priceHistory.map((point, index) => {
      const x = padding + (index / (priceHistory.length - 1)) * (chartWidth - 2 * padding);
      const barHeight = (point.volume / maxVolume) * 40;
      const y = chartHeight - barHeight - 10;
      
      return { x, y, height: barHeight, volume: point.volume };
    });
  }, [priceHistory, maxVolume, chartWidth, chartHeight, padding]);

  const isPositive = marketData.priceChange24h >= 0;

  return (
    <Card className="bg-black/40 border-gray-800 text-white">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-400" />
            SOL/USD
          </CardTitle>
          <Badge variant="outline" className={`${isPositive ? 'text-green-400 border-green-400' : 'text-red-400 border-red-400'}`}>
            <Activity className="w-3 h-3 mr-1" />
            Live
          </Badge>
        </div>
        <CardDescription className="text-gray-400">
          Real-time price and volume data
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Price Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-2xl font-bold">
              ${marketData.currentPrice.toFixed(2)}
            </div>
            <div className={`text-sm flex items-center gap-1 ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
              {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {isPositive ? '+' : ''}{marketData.priceChange24h.toFixed(2)} ({isPositive ? '+' : ''}{marketData.priceChangePercent24h.toFixed(2)}%)
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">24h High</span>
              <span>${marketData.high24h.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">24h Low</span>
              <span>${marketData.low24h.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="relative bg-gray-900/50 rounded-lg p-4 overflow-hidden">
          <svg
            width={chartWidth}
            height={chartHeight}
            className="w-full h-auto"
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          >
            {/* Grid lines */}
            <defs>
              <pattern id="grid" width="40" height="20" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 20" fill="none" stroke="#374151" strokeWidth="0.5" opacity="0.3"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />

            {/* Volume bars */}
            {volumeBars.map((bar, index) => (
              <rect
                key={index}
                x={bar.x - 1}
                y={bar.y}
                width="2"
                height={bar.height}
                fill="#6366f1"
                opacity="0.3"
              />
            ))}

            {/* Price line */}
            <path
              d={pricePath}
              stroke="url(#priceGradient)"
              strokeWidth="2"
              fill="none"
              className="drop-shadow-lg"
            />

            {/* Price area fill */}
            {priceHistory.length > 1 && (
              <path
                d={`${pricePath} L ${chartWidth - padding},${chartHeight - padding} L ${padding},${chartHeight - padding} Z`}
                fill="url(#areaGradient)"
                opacity="0.1"
              />
            )}

            {/* Current price indicator */}
            {priceHistory.length > 0 && (
              <circle
                cx={chartWidth - padding}
                cy={padding + (1 - (marketData.currentPrice - minPrice) / (maxPrice - minPrice)) * (chartHeight - 2 * padding)}
                r="4"
                fill="#10b981"
                className="animate-pulse"
              />
            )}

            {/* Gradient definitions */}
            <defs>
              <linearGradient id="priceGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
              <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#1e293b" />
              </linearGradient>
            </defs>
          </svg>

          {/* Price labels */}
          <div className="absolute top-4 left-4 text-xs text-gray-400">
            ${maxPrice.toFixed(2)}
          </div>
          <div className="absolute bottom-4 left-4 text-xs text-gray-400">
            ${minPrice.toFixed(2)}
          </div>
        </div>

        {/* Volume and Trade Stats */}
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="flex items-center gap-1 text-gray-400 mb-1">
              <Volume2 className="w-3 h-3" />
              24h Volume
            </div>
            <div className="font-semibold">${(marketData.volume24h / 1000).toFixed(0)}K</div>
          </div>
          
          <div>
            <div className="flex items-center gap-1 text-gray-400 mb-1">
              <BarChart3 className="w-3 h-3" />
              24h Trades
            </div>
            <div className="font-semibold">{marketData.trades24h.toLocaleString()}</div>
          </div>
          
          <div>
            <div className="flex items-center gap-1 text-gray-400 mb-1">
              <Clock className="w-3 h-3" />
              Updated
            </div>
            <div className="font-semibold">Live</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}