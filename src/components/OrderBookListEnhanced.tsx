'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, Shuffle, Eye, ShieldCheck, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { useTrading } from '../contexts/TradingContext';

interface Order {
  id: number | string;
  trader?: string;
  amount: string;
  price: string;
  encrypted?: string;
  status?: string;
  type: 'buy' | 'sell';
  timestamp?: number;
  token?: string;
}

interface LegacyProps {
  orders: Order[];
  isMatching: boolean;
}

export function OrderBookList({ orders: legacyOrders, isMatching }: LegacyProps) {
  const [shuffling, setShuffling] = useState(false);
  const [selectedToken, setSelectedToken] = useState('SOL');
  
  // Use trading context for real-time data
  const { 
    orders: contextOrders, 
    orderBook, 
    orderBookUpdates,
    refreshOrderBook,
    isConnected,
    isAuthenticated 
  } = useTrading();

  // Combine legacy orders with context orders for backward compatibility
  const allOrders = [...(contextOrders || []), ...legacyOrders].reduce((acc, order) => {
    const key = order.id;
    if (key && !acc.find(o => o.id === key)) {
      acc.push({
        id: order.id,
        trader: order.trader || 'Unknown',
        amount: order.amount,
        price: order.price,
        encrypted: order.encrypted,
        status: order.status || 'pending',
        type: order.type,
        timestamp: order.timestamp || Date.now(),
        token: (order as any).token
      });
    }
    return acc;
  }, [] as Order[]);

  const [displayOrders, setDisplayOrders] = useState(allOrders);

  // Update display orders when data changes
  useEffect(() => {
    if (isMatching && !shuffling) {
      setShuffling(true);
      const interval = setInterval(() => {
        setDisplayOrders(prev => [...prev].sort(() => Math.random() - 0.5));
      }, 200);

      setTimeout(() => {
        clearInterval(interval);
        setShuffling(false);
        setDisplayOrders(allOrders);
      }, 2000);

      return () => clearInterval(interval);
    } else {
      setDisplayOrders(allOrders);
    }
  }, [isMatching, allOrders, shuffling]);

  // Refresh orderbook periodically
  useEffect(() => {
    if (isConnected && isAuthenticated) {
      refreshOrderBook(selectedToken);
      
      const interval = setInterval(() => {
        refreshOrderBook(selectedToken);
      }, 5000); // Refresh every 5 seconds

      return () => clearInterval(interval);
    }
  }, [isConnected, isAuthenticated, selectedToken, refreshOrderBook]);

  // Separate buy and sell orders from real data
  const buyOrders = displayOrders
    .filter(order => order.type === 'buy' && order.status && ['pending', 'open', 'partial'].includes(order.status))
    .sort((a, b) => parseFloat(b.price) - parseFloat(a.price))
    .slice(0, 15);
    
  const sellOrders = displayOrders
    .filter(order => order.type === 'sell' && order.status && ['pending', 'open', 'partial'].includes(order.status))
    .sort((a, b) => parseFloat(a.price) - parseFloat(b.price))
    .slice(0, 15);

  // Calculate market spread from real orders
  const bestBid = buyOrders.length > 0 ? parseFloat(buyOrders[0].price) : 0;
  const bestAsk = sellOrders.length > 0 ? parseFloat(sellOrders[0].price) : 0;
  const spread = bestAsk && bestBid ? bestAsk - bestBid : 0;
  const spreadPercent = bestBid ? (spread / bestBid) * 100 : 0;

  // Calculate total depth
  const totalBuyVolume = buyOrders.reduce((sum, order) => sum + parseFloat(order.amount), 0);
  const totalSellVolume = sellOrders.reduce((sum, order) => sum + parseFloat(order.amount), 0);

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-[#0a0118] to-[#1a0b2e] border border-cyan-500/20 shadow-2xl relative overflow-hidden">
      {/* Glassmorphism overlay */}
      <div className="absolute inset-0 bg-white/5 backdrop-blur-sm"></div>
      
      {/* Header */}
      <div className="relative z-10 border-b border-cyan-500/20 bg-white/5 backdrop-blur-md px-2 sm:px-4 py-2 sm:py-3">
        <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1 sm:p-2 rounded-lg bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30">
              <BarChart3 className="w-3 h-3 sm:w-4 sm:h-4 text-purple-400" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm md:text-base font-bold text-white">Order Book</h3>
              <div className="flex items-center gap-1 sm:gap-2 mt-0.5">
                <div className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full ${
                  isConnected && isAuthenticated 
                    ? 'bg-[#00ff88] animate-pulse' 
                    : 'bg-red-400 animate-pulse'
                }`}></div>
                <span className={`text-xs font-medium ${
                  isConnected && isAuthenticated ? 'text-[#00ff88]' : 'text-red-400'
                }`}>
                  {isConnected && isAuthenticated ? `Live Updates (${orderBookUpdates})` : 'Disconnected'}
                </span>
              </div>
            </div>
          </div>
          
          {/* Token Selector */}
          <div className="flex items-center gap-2">
            <select 
              value={selectedToken}
              onChange={(e) => setSelectedToken(e.target.value)}
              className="bg-white/10 border border-cyan-500/20 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-400"
            >
              <option value="SOL">SOL/USDC</option>
              <option value="ETH">ETH/USDC</option>
              <option value="BTC">BTC/USDC</option>
            </select>
          </div>
        </div>

        {/* Market Stats */}
        <div className="mt-2 sm:mt-3 grid grid-cols-3 gap-2 text-xs">
          <div className="text-center">
            <div className="text-[#b4b4b4]">Spread</div>
            <div className="font-mono text-cyan-400">
              {spread > 0 ? `$${spread.toFixed(4)}` : '--'}
            </div>
            <div className="text-[#b4b4b4] text-[10px]">
              {spreadPercent > 0 ? `${spreadPercent.toFixed(2)}%` : '--'}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[#b4b4b4]">Depth</div>
            <div className="font-mono text-green-400">
              {totalBuyVolume.toFixed(2)}
            </div>
            <div className="font-mono text-red-400">
              {totalSellVolume.toFixed(2)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[#b4b4b4]">Orders</div>
            <div className="font-mono text-white">
              {buyOrders.length + sellOrders.length}
            </div>
            <div className="text-[#b4b4b4] text-[10px]">
              {buyOrders.length}B {sellOrders.length}S
            </div>
          </div>
        </div>
      </div>

      {/* Order Book Content */}
      <div className="relative z-10 flex-1 overflow-hidden">
        <div className="h-full flex flex-col">
          
          {/* Sell Orders (Asks) - Top Half */}
          <div className="flex-1 overflow-y-auto">
            <div className="px-2 sm:px-4 py-2">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="w-3 h-3 text-red-400" />
                <span className="text-xs font-bold text-red-400">ASKS ({sellOrders.length})</span>
              </div>
              
              {/* Sell Orders Header */}
              <div className="grid grid-cols-3 gap-1 sm:gap-2 mb-1 text-[10px] sm:text-xs text-[#b4b4b4] font-semibold">
                <div className="text-right">Size</div>
                <div className="text-right">Price</div>
                <div className="text-right">Total</div>
              </div>

              <AnimatePresence>
                {sellOrders.length > 0 ? (
                  <div className="space-y-0.5">
                    {sellOrders.map((order, index) => {
                      const cumulativeVolume = sellOrders
                        .slice(0, index + 1)
                        .reduce((sum, o) => sum + parseFloat(o.amount), 0);
                      const maxVolume = Math.max(totalSellVolume, 1);
                      const widthPercent = (cumulativeVolume / maxVolume) * 100;

                      return (
                        <motion.div
                          key={`sell-${order.id}`}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          transition={{ duration: 0.3, delay: index * 0.02 }}
                          className="relative group cursor-pointer hover:bg-red-500/10 rounded p-0.5 sm:p-1"
                        >
                          {/* Depth Bar */}
                          <div 
                            className="absolute inset-y-0 right-0 bg-red-500/20 rounded"
                            style={{ width: `${widthPercent}%` }}
                          />
                          
                          <div className="relative z-10 grid grid-cols-3 gap-1 sm:gap-2 text-[10px] sm:text-xs">
                            <div className="text-right font-mono text-white">
                              {parseFloat(order.amount).toFixed(4)}
                            </div>
                            <div className="text-right font-mono text-red-400 font-bold">
                              ${parseFloat(order.price).toFixed(2)}
                            </div>
                            <div className="text-right font-mono text-[#b4b4b4]">
                              ${(parseFloat(order.amount) * parseFloat(order.price)).toFixed(2)}
                            </div>
                          </div>

                          {/* Hover Info */}
                          <div className="absolute left-0 top-0 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 rounded px-1 py-0.5 text-[10px] text-white -translate-y-full z-20">
                            {order.status} • {order.timestamp ? new Date(order.timestamp).toLocaleTimeString() : 'Recent'}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-4 text-[#b4b4b4] text-xs">
                    No sell orders
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Spread Indicator */}
          <div className="border-t border-b border-cyan-500/20 bg-white/5 backdrop-blur-md px-2 sm:px-4 py-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-gradient-to-r from-red-400 to-green-400 rounded-full"></div>
                <span className="text-[#b4b4b4]">Spread</span>
              </div>
              <div className="font-mono text-cyan-400 font-bold">
                {spread > 0 ? `$${spread.toFixed(4)} (${spreadPercent.toFixed(2)}%)` : 'No spread'}
              </div>
            </div>
          </div>

          {/* Buy Orders (Bids) - Bottom Half */}
          <div className="flex-1 overflow-y-auto">
            <div className="px-2 sm:px-4 py-2">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-3 h-3 text-green-400" />
                <span className="text-xs font-bold text-green-400">BIDS ({buyOrders.length})</span>
              </div>

              {/* Buy Orders Header */}
              <div className="grid grid-cols-3 gap-1 sm:gap-2 mb-1 text-[10px] sm:text-xs text-[#b4b4b4] font-semibold">
                <div className="text-right">Size</div>
                <div className="text-right">Price</div>
                <div className="text-right">Total</div>
              </div>

              <AnimatePresence>
                {buyOrders.length > 0 ? (
                  <div className="space-y-0.5">
                    {buyOrders.map((order, index) => {
                      const cumulativeVolume = buyOrders
                        .slice(0, index + 1)
                        .reduce((sum, o) => sum + parseFloat(o.amount), 0);
                      const maxVolume = Math.max(totalBuyVolume, 1);
                      const widthPercent = (cumulativeVolume / maxVolume) * 100;

                      return (
                        <motion.div
                          key={`buy-${order.id}`}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          transition={{ duration: 0.3, delay: index * 0.02 }}
                          className="relative group cursor-pointer hover:bg-green-500/10 rounded p-0.5 sm:p-1"
                        >
                          {/* Depth Bar */}
                          <div 
                            className="absolute inset-y-0 right-0 bg-green-500/20 rounded"
                            style={{ width: `${widthPercent}%` }}
                          />
                          
                          <div className="relative z-10 grid grid-cols-3 gap-1 sm:gap-2 text-[10px] sm:text-xs">
                            <div className="text-right font-mono text-white">
                              {parseFloat(order.amount).toFixed(4)}
                            </div>
                            <div className="text-right font-mono text-green-400 font-bold">
                              ${parseFloat(order.price).toFixed(2)}
                            </div>
                            <div className="text-right font-mono text-[#b4b4b4]">
                              ${(parseFloat(order.amount) * parseFloat(order.price)).toFixed(2)}
                            </div>
                          </div>

                          {/* Hover Info */}
                          <div className="absolute left-0 bottom-0 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 rounded px-1 py-0.5 text-[10px] text-white translate-y-full z-20">
                            {order.status} • {order.timestamp ? new Date(order.timestamp).toLocaleTimeString() : 'Recent'}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-4 text-[#b4b4b4] text-xs">
                    No buy orders
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Matching Animation Overlay */}
      <AnimatePresence>
        {(isMatching || shuffling) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
          >
            <div className="text-center">
              <Shuffle className="w-8 h-8 mx-auto text-[#00f0ff] animate-spin mb-2" />
              <div className="text-white font-bold text-sm mb-1">Matching Orders</div>
              <div className="text-[#b4b4b4] text-xs">Zero-knowledge matching in progress...</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Privacy Indicators */}
      <div className="absolute top-2 right-2 flex gap-1">
        <div className="w-2 h-2 bg-[#00ff88] rounded-full animate-pulse" title="Order amounts encrypted" />
        <div className="w-2 h-2 bg-[#00f0ff] rounded-full animate-pulse" title="VRF matching active" />
        <div className="w-2 h-2 bg-[#ff00e5] rounded-full animate-pulse" title="Threshold signatures" />
      </div>
    </div>
  );
}