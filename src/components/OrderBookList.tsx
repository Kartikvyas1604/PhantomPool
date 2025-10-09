'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, Shuffle, Eye, ShieldCheck } from 'lucide-react';

interface Order {
  id: number;
  trader: string;
  amount: string;
  price: string;
  encrypted: string;
  status: string;
  type: 'buy' | 'sell';
  timestamp: number;
}

export function OrderBookList({ orders, isMatching }: { orders: Order[]; isMatching: boolean }) {
  const [shuffling, setShuffling] = useState(false);
  const [displayOrders, setDisplayOrders] = useState(orders);

  useEffect(() => {
    if (isMatching && !shuffling) {
      setShuffling(true);
      const interval = setInterval(() => {
        setDisplayOrders(prev => [...prev].sort(() => Math.random() - 0.5));
      }, 200);

      setTimeout(() => {
        clearInterval(interval);
        setShuffling(false);
        setDisplayOrders(orders);
      }, 2000);

      return () => clearInterval(interval);
    } else {
      setDisplayOrders(orders);
    }
  }, [isMatching, orders, shuffling]);

  // Separate buy and sell orders from real data
  const buyOrders = displayOrders.filter(order => order.type === 'buy')
    .sort((a, b) => parseFloat(b.price) - parseFloat(a.price))
    .slice(0, 10); // Show top 10 buy orders
    
  const sellOrders = displayOrders.filter(order => order.type === 'sell')
    .sort((a, b) => parseFloat(a.price) - parseFloat(b.price))
    .slice(0, 10); // Show top 10 sell orders

  // Calculate market spread from real orders
  const bestBid = buyOrders.length > 0 ? parseFloat(buyOrders[0].price) : 0;
  const bestAsk = sellOrders.length > 0 ? parseFloat(sellOrders[0].price) : 0;
  const spread = bestAsk > 0 && bestBid > 0 ? bestAsk - bestBid : 0;
  const midPrice = bestAsk > 0 && bestBid > 0 ? (bestAsk + bestBid) / 2 : 0;

  return (
    <div className="h-full flex flex-col bg-black/20 backdrop-blur-sm">
      {/* Header */}
      <div className="border-b border-slate-800/50 bg-black/80 px-3 py-2 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white">Order Book</h3>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
            <Eye className="w-3 h-3" />
            <span>SOL/USDC</span>
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            <span>Encrypted</span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {isMatching && (
            <div className="flex items-center gap-1 text-orange-400">
              <Shuffle className="w-3 h-3" />
              <span>Matching</span>
            </div>
          )}
          <div className="text-slate-400">
            {displayOrders.length} orders
          </div>
        </div>
      </div>

      {/* Professional Order Book Headers */}
      <div className="px-3 sm:px-6 py-3 border-b border-slate-700/50 bg-gradient-to-r from-slate-800/50 to-slate-700/30">
        <div className="grid grid-cols-3 gap-3 sm:gap-6 text-xs sm:text-sm font-semibold text-slate-300">
          <div className="text-left">Price (USDC)</div>
          <div className="text-right">Size (SOL)</div>
          <div className="text-right hidden sm:block">Total (USDC)</div>
          <div className="text-right sm:hidden">Total</div>
        </div>
      </div>

      {/* Advanced Order Book Content */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full flex flex-col">
          {/* Asks (Sell Orders) - Professional Layout */}
          <div className="flex-1 flex flex-col-reverse px-3 sm:px-6 py-3 overflow-y-auto">
            <div className="space-y-1">
              {sellOrders.length > 0 ? sellOrders.map((order, index) => (
                <motion.div
                  key={`ask-${order.id}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="relative group"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 to-transparent rounded-lg opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="grid grid-cols-3 gap-3 sm:gap-6 text-xs sm:text-sm py-1 sm:py-2 px-2 sm:px-3 hover:bg-red-900/10 rounded-lg cursor-pointer transition-all duration-200 relative z-10">
                    <div className="text-red-400 font-mono font-semibold">${parseFloat(order.price).toFixed(2)}</div>
                    <div className="text-right text-slate-200 font-mono">{parseFloat(order.amount).toFixed(4)}</div>
                    <div className="text-right text-slate-400 font-mono">${(parseFloat(order.price) * parseFloat(order.amount)).toFixed(2)}</div>
                  </div>
                </motion.div>
              )) : (
                <div className="text-center text-slate-400 py-8">
                  <div className="text-sm">No sell orders</div>
                </div>
              )}
            </div>
          </div>

          {/* Professional Spread Indicator */}
          <div className="px-3 sm:px-6 py-3 sm:py-4 border-y border-slate-700/50 bg-gradient-to-r from-slate-800/60 to-slate-700/40">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                <span className="text-xs sm:text-sm font-medium text-slate-300">Market Spread</span>
              </div>
              <div className="text-right">
                <div className="text-lg font-mono font-bold bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">
                  ${midPrice > 0 ? midPrice.toFixed(2) : '0.00'}
                </div>
                <div className="text-xs text-slate-400">
                  {spread > 0 ? `${spread.toFixed(2)} USDC (${((spread / midPrice) * 100).toFixed(2)}%)` : 'No spread data'}
                </div>
              </div>
            </div>
          </div>

          {/* Bids (Buy Orders) - Professional Layout */}
          <div className="flex-1 px-3 sm:px-6 py-3 overflow-y-auto">
            <div className="space-y-1">
              {buyOrders.length > 0 ? buyOrders.map((order, index) => (
                <motion.div
                  key={`bid-${order.id}`}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="relative group"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-transparent rounded-lg opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="grid grid-cols-3 gap-3 sm:gap-6 text-xs sm:text-sm py-1 sm:py-2 px-2 sm:px-3 hover:bg-emerald-900/10 rounded-lg cursor-pointer transition-all duration-200 relative z-10">
                    <div className="text-emerald-400 font-mono font-semibold">${parseFloat(order.price).toFixed(2)}</div>
                    <div className="text-right text-slate-200 font-mono">{parseFloat(order.amount).toFixed(4)}</div>
                    <div className="text-right text-slate-400 font-mono">${(parseFloat(order.price) * parseFloat(order.amount)).toFixed(2)}</div>
                  </div>
                </motion.div>
              )) : (
                <div className="text-center text-slate-400 py-8">
                  <div className="text-sm">No buy orders</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Encrypted Orders Section */}
      {displayOrders.length > 0 && (
        <div className="border-t border-slate-700/50 bg-gradient-to-r from-slate-800/50 to-slate-700/30 flex-shrink-0">
          <div className="max-h-64 overflow-y-auto">
            <div className="px-6 py-3 border-b border-slate-700/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-semibold text-blue-400">Encrypted Orders Queue</span>
                  <span className="text-xs px-2 py-1 bg-blue-900/30 text-blue-300 rounded-full">
                    {displayOrders.length}
                  </span>
                </div>
                <div className="text-xs text-slate-400">Awaiting Threshold Decryption</div>
              </div>
            </div>
            <div className="p-4">
              <div className="space-y-2">
                <AnimatePresence mode="popLayout">
                  {displayOrders.map((order) => (
                    <motion.div
                      key={order.id}
                      layout
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="relative group"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-blue-500/5 rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300" />
                      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-slate-800/40 to-slate-700/30 border border-slate-700/30 rounded-xl hover:border-slate-600/50 transition-all duration-200 relative z-10">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${
                              order.type === 'buy' ? 'bg-emerald-400' : 'bg-red-400'
                            } animate-pulse`} />
                            <span className="text-sm text-slate-200 font-mono">{order.trader}</span>
                          </div>
                          <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                            order.type === 'buy' 
                              ? 'bg-gradient-to-r from-emerald-900/40 to-emerald-800/40 text-emerald-300 border border-emerald-500/30' 
                              : 'bg-gradient-to-r from-red-900/40 to-red-800/40 text-red-300 border border-red-500/30'
                          }`}>
                            {order.type.toUpperCase()}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-xs text-slate-400 font-mono">{order.encrypted}</div>
                          <div className="flex items-center gap-1">
                            <div className="w-1 h-1 bg-blue-400 rounded-full animate-ping"></div>
                            <div className="w-1 h-1 bg-purple-400 rounded-full animate-ping" style={{ animationDelay: '0.2s' }}></div>
                            <div className="w-1 h-1 bg-blue-400 rounded-full animate-ping" style={{ animationDelay: '0.4s' }}></div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Professional Empty State */}
      {displayOrders.length === 0 && (
        <div className="flex-1 flex items-center justify-center border-t border-slate-700/50 bg-gradient-to-br from-slate-800/20 to-slate-700/10">
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gradient-to-br from-slate-700 to-slate-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-slate-400" />
            </div>
            <h4 className="text-lg font-semibold text-slate-300 mb-2">No Encrypted Orders</h4>
            <p className="text-sm text-slate-400 mb-1">The dark pool is awaiting your first order</p>
            <p className="text-xs text-slate-500">Submit an encrypted order to begin zero-knowledge trading</p>
          </div>
        </div>
      )}
    </div>
  );
}