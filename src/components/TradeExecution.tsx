'use client';

import { motion } from 'motion/react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { ExternalLink, Zap, Shield, TrendingUp } from 'lucide-react';
import { Button } from './ui/button';
import { ThresholdDecryptionProgress } from './ThresholdDecryptionProgress';

interface Trade {
  id: string;
  type: 'buy' | 'sell';
  amount: string;
  price: string;
  timestamp: number;
  buyOrder?: string;
  sellOrder?: string;
  clearingPrice?: string;
}

interface TradeExecutionProps {
  matchedTrades: Trade[];
}

export function TradeExecution({ matchedTrades }: TradeExecutionProps) {
  return (
    <div className="space-y-6">
      {/* Matched Trades */}
      <Card className="bg-white/5 border border-[#00f0ff]/20 backdrop-blur-xl relative overflow-hidden group hover:border-[#00f0ff]/40 transition-all duration-300">
        {/* Glow effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#00ff88]/5 to-[#00f0ff]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        <div className="relative z-10">
          <div className="p-6 border-b border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-white mb-1">Recent Matches</h3>
                <p className="text-[#b4b4b4] text-sm">Fair clearing price execution</p>
              </div>
              <Badge variant="outline" className="border-[#00ff88]/50 text-[#00ff88] bg-[#00ff88]/10">
                {matchedTrades.length} Trades
              </Badge>
            </div>
          </div>

          <div className="max-h-[300px] overflow-y-auto">
            {matchedTrades.length === 0 ? (
              <div className="p-12 text-center">
                <TrendingUp className="w-12 h-12 text-white/20 mx-auto mb-4" />
                <p className="text-[#b4b4b4]">No matched trades yet</p>
                <p className="text-[#b4b4b4]/70 text-sm mt-1">Orders will appear here after matching</p>
              </div>
            ) : (
              matchedTrades.map((trade, index) => (
                <motion.div
                  key={trade.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="p-4 border-b border-white/5 hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Shield className="w-4 h-4 text-[#00ff88]" />
                        <span className="text-white text-sm">Trade #{trade.id.toString().slice(-4)}</span>
                      </div>
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-[#b4b4b4]">Buyer:</span>
                          <span className="text-white/70">{trade.buyOrder}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[#b4b4b4]">Seller:</span>
                          <span className="text-white/70">{trade.sellOrder}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[#00ff88] mb-1">${trade.clearingPrice}</div>
                      <div className="text-white/70 text-sm">{trade.amount}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="border-[#00ff88]/50 text-[#00ff88] bg-[#00ff88]/10 text-xs">
                      ✓ ZK Proof Verified
                    </Badge>
                    <span className="text-[#b4b4b4]/70 text-xs">
                      {new Date(trade.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </Card>

      {/* Threshold Decryption Status */}
      <ThresholdDecryptionProgress />

      {/* Jupiter Execution Preview */}
      <Card className="bg-white/5 border border-[#00f0ff]/20 backdrop-blur-xl p-6 relative overflow-hidden group hover:border-[#00f0ff]/40 transition-all duration-300">
        {/* Glow effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#00f0ff]/5 to-[#ff00e5]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-[#00f0ff]/20 p-2 rounded-lg">
              <Zap className="w-5 h-5 text-[#00f0ff]" />
            </div>
            <div>
              <h3 className="text-white">Jupiter Integration</h3>
              <p className="text-[#b4b4b4] text-sm">Best route for execution</p>
            </div>
          </div>

          <div className="space-y-3 mb-4">
            <div className="flex justify-between items-center py-2 border-b border-white/10">
              <span className="text-[#b4b4b4] text-sm">Route</span>
              <span className="text-white text-sm">Raydium → Orca</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-white/10">
              <span className="text-[#b4b4b4] text-sm">Expected Slippage</span>
              <span className="text-[#00ff88] text-sm">0.04%</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-[#b4b4b4] text-sm">Price Impact</span>
              <span className="text-[#00ff88] text-sm">0.12%</span>
            </div>
          </div>

          <Button 
            variant="outline" 
            className="w-full border-[#00f0ff]/50 text-[#00f0ff] hover:bg-[#00f0ff]/10 gap-2"
          >
            View on Solscan
            <ExternalLink className="w-4 h-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}
