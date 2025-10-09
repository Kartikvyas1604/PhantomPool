'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, Shuffle } from 'lucide-react';

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

  // Generate some mock order book data for display
  const mockBids = [
    { price: 149.45, size: 1250, total: 1250 },
    { price: 149.40, size: 890, total: 2140 },
    { price: 149.35, size: 2100, total: 4240 },
    { price: 149.30, size: 750, total: 4990 },
    { price: 149.25, size: 1800, total: 6790 },
  ];

  const mockAsks = [
    { price: 149.55, size: 980, total: 980 },
    { price: 149.60, size: 1400, total: 2380 },
    { price: 149.65, size: 750, total: 3130 },
    { price: 149.70, size: 2200, total: 5330 },
    { price: 149.75, size: 1100, total: 6430 },
  ];

  return (
    <div className="h-full flex flex-col bg-slate-900/30">
      {/* Header */}
      <div className="border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-100">Order Book</h3>
          <p className="text-xs text-slate-400 mt-1">SOL/USDC • Encrypted Orders</p>
        </div>
        {shuffling && (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            <Shuffle className="w-4 h-4 text-blue-400" />
          </motion.div>
        )}
      </div>

      {/* Order Book Headers */}
      <div className="px-4 py-2 border-b border-slate-800 bg-slate-800/50">
        <div className="grid grid-cols-3 gap-4 text-xs font-medium text-slate-400">
          <div className="text-left">Price (USDC)</div>
          <div className="text-right">Size (SOL)</div>
          <div className="text-right">Total</div>
        </div>
      </div>

      {/* Order Book Content */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full flex flex-col">
          {/* Asks (Sell Orders) */}
          <div className="flex-1 flex flex-col-reverse px-4 py-2 space-y-reverse space-y-1">
            {mockAsks.map((ask, index) => (
              <div
                key={`ask-${index}`}
                className="grid grid-cols-3 gap-4 text-xs py-1 hover:bg-red-900/20 rounded cursor-pointer transition-colors"
              >
                <div className="text-red-400 font-mono">{ask.price.toFixed(2)}</div>
                <div className="text-right text-slate-300 font-mono">{ask.size.toLocaleString()}</div>
                <div className="text-right text-slate-400 font-mono text-xs">{ask.total.toLocaleString()}</div>
              </div>
            ))}
          </div>

          {/* Spread */}
          <div className="px-4 py-3 border-y border-slate-800 bg-slate-800/30">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Spread</span>
              <div className="text-right">
                <div className="text-sm font-mono text-emerald-400">$149.50</div>
                <div className="text-xs text-slate-500">0.10 (0.07%)</div>
              </div>
            </div>
          </div>

          {/* Bids (Buy Orders) */}
          <div className="flex-1 px-4 py-2 space-y-1">
            {mockBids.map((bid, index) => (
              <div
                key={`bid-${index}`}
                className="grid grid-cols-3 gap-4 text-xs py-1 hover:bg-emerald-900/20 rounded cursor-pointer transition-colors"
              >
                <div className="text-emerald-400 font-mono">{bid.price.toFixed(2)}</div>
                <div className="text-right text-slate-300 font-mono">{bid.size.toLocaleString()}</div>
                <div className="text-right text-slate-400 font-mono text-xs">{bid.total.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Encrypted Orders Section */}
      {displayOrders.length > 0 && (
        <div className="border-t border-slate-800 max-h-48 overflow-y-auto">
          <div className="px-4 py-2 bg-slate-800/50">
            <div className="flex items-center gap-2 text-xs text-blue-400">
              <Lock className="w-3 h-3" />
              <span>Encrypted Orders ({displayOrders.length})</span>
            </div>
          </div>
          <div className="space-y-1 p-4">
            <AnimatePresence mode="popLayout">
              {displayOrders.map((order) => (
                <motion.div
                  key={order.id}
                  layout
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="flex items-center justify-between py-2 px-3 bg-slate-800/30 rounded border border-slate-700/50 hover:border-slate-600/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      order.type === 'buy' ? 'bg-emerald-400' : 'bg-red-400'
                    }`} />
                    <span className="text-xs text-slate-300 font-mono">{order.trader}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      order.type === 'buy' 
                        ? 'bg-emerald-900/30 text-emerald-400' 
                        : 'bg-red-900/30 text-red-400'
                    }`}>
                      {order.type.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 font-mono">{order.encrypted}</div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Empty State */}
      {displayOrders.length === 0 && (
        <div className="flex-1 flex items-center justify-center border-t border-slate-800">
          <div className="text-center py-12">
            <Lock className="w-8 h-8 text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-400">No encrypted orders</p>
            <p className="text-xs text-slate-500 mt-1">Submit an order to get started</p>
          </div>
        </div>
      )}
    </div>
  );
}