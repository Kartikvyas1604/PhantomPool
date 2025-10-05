'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Lock, Copy, CheckCircle, Shuffle } from 'lucide-react';
import { Button } from './ui/button';

export function OrderBookList({ orders, isMatching }: { orders: any[]; isMatching: boolean }) {
  const [shuffling, setShuffling] = useState(false);
  const [displayOrders, setDisplayOrders] = useState(orders);

  useEffect(() => {
    if (isMatching && !shuffling) {
      setShuffling(true);
      // Simulate VRF shuffle animation
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
  }, [isMatching, orders]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <Card className="bg-white/5 border border-[#00f0ff]/20 backdrop-blur-xl overflow-hidden relative group hover:border-[#00f0ff]/40 transition-all duration-300">
      {/* Glow effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#00f0ff]/5 to-[#ff00e5]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      {/* Header */}
      <div className="p-3 sm:p-6 border-b border-white/10 relative z-10">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-white mb-1 text-base sm:text-lg">Encrypted Order Book</h3>
            <p className="text-[#b4b4b4] text-xs sm:text-sm">Homomorphically encrypted orders</p>
          </div>
          {shuffling && (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >
              <Shuffle className="w-5 h-5 text-[#ff00e5]" />
            </motion.div>
          )}
        </div>

        {shuffling && (
          <div className="mt-3 bg-[#ff00e5]/10 border border-[#ff00e5]/30 rounded-lg p-3">
            <p className="text-[#ff00e5] text-sm">🎲 VRF Shuffle in Progress</p>
            <p className="text-[#ff00e5]/70 text-xs mt-1">
              Randomizing order sequence for fair matching...
            </p>
          </div>
        )}
      </div>

      {/* Order List */}
      <div className="relative z-10 max-h-[600px] overflow-y-auto">
        <AnimatePresence mode="popLayout">
          {displayOrders.length === 0 ? (
            <div className="p-6 sm:p-12 text-center">
              <Lock className="w-8 h-8 sm:w-12 sm:h-12 text-white/20 mx-auto mb-3 sm:mb-4" />
              <p className="text-[#b4b4b4] text-sm sm:text-base">No encrypted orders yet</p>
              <p className="text-[#b4b4b4]/70 text-xs sm:text-sm mt-1">Submit your first order to get started</p>
            </div>
          ) : (
            displayOrders.map((order, index) => (
              <motion.div
                key={order.id}
                layout
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.3 }}
                className={`p-3 sm:p-4 border-b border-white/5 hover:bg-white/5 transition-colors ${
                  order.status === 'matched' ? 'bg-[#00ff88]/5' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-2 sm:mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-1 sm:gap-2 mb-1 sm:mb-2 flex-wrap">
                      <Lock className="w-3 h-3 text-[#00f0ff]" />
                      <span className="text-white text-xs sm:text-sm">{order.trader}</span>
                      <Badge
                        variant="outline"
                        className={`${
                          order.type === 'buy'
                            ? 'border-[#00f0ff]/50 text-[#00f0ff] bg-[#00f0ff]/10'
                            : 'border-[#ff00e5]/50 text-[#ff00e5] bg-[#ff00e5]/10'
                        }`}
                      >
                        {order.type}
                      </Badge>
                    </div>
                    
                    {/* Encrypted Amount */}
                    <div className="flex items-center gap-1 sm:gap-2 mb-1 sm:mb-2">
                      <span className="text-[#b4b4b4] text-xs">Size:</span>
                      <span className="text-white/30 text-xs sm:text-sm font-mono">█████████</span>
                    </div>

                    {/* Order Hash */}
                    <div className="flex items-center gap-1 sm:gap-2">
                      <span className="text-white/70 text-xs font-mono truncate max-w-[120px] sm:max-w-none">{order.encrypted}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(order.encrypted)}
                        className="h-5 w-5 sm:h-6 sm:w-6 p-0 hover:bg-white/10 flex-shrink-0"
                      >
                        <Copy className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[#b4b4b4]" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 sm:gap-2 ml-2">
                    {/* ZK Proof Status */}
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-[#00ff88] rounded-full animate-pulse" />
                      <span className="text-[#00ff88] text-xs hidden sm:inline">ZK-Verified</span>
                      <span className="text-[#00ff88] text-xs sm:hidden">✓</span>
                    </div>

                    {/* Status Badge */}
                    {order.status === 'matched' && (
                      <Badge
                        variant="outline"
                        className="border-[#00ff88]/50 text-[#00ff88] bg-[#00ff88]/10"
                      >
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Matched
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Timestamp */}
                <div className="text-[#b4b4b4]/70 text-xs">
                  {new Date(order.timestamp).toLocaleTimeString()}
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      {displayOrders.length > 0 && (
        <div className="p-3 sm:p-4 border-t border-white/10 bg-white/5 relative z-10">
          <div className="flex items-center justify-between text-xs sm:text-sm">
            <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
              <div>
                <span className="text-[#b4b4b4]">Orders: </span>
                <span className="text-white">{displayOrders.length}</span>
              </div>
              <div>
                <span className="text-[#b4b4b4] hidden sm:inline">Encrypted Volume: </span>
                <span className="text-[#b4b4b4] sm:hidden">Vol: </span>
                <span className="text-white/30 font-mono">████ SOL</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
