'use client';

import { motion } from 'motion/react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { ExternalLin            <div className=\"space-y-2 sm:space-y-3 mb-3 sm:mb-4\">
            <div className=\"flex justify-between items-center py-1.5 sm:py-2 border-b border-white/10\">
              <span className=\"text-[#b4b4b4] text-xs sm:text-sm\">Route</span>
              <span className=\"text-white text-xs sm:text-sm\">
                {jupiterRoute ? jupiterRoute.route.join(' → ') : 'Raydium → Orca'}
              </span>
            </div>
            <div className=\"flex justify-between items-center py-1.5 sm:py-2 border-b border-white/10\">
              <span className=\"text-[#b4b4b4] text-xs sm:text-sm\">Expected Output</span>
              <span className=\"text-[#00ff88] text-xs sm:text-sm\">
                {jupiterRoute ? `${parseFloat(jupiterRoute.expectedOutput).toFixed(2)} USDC` : '14,950 USDC'}
              </span>
            </div>
            <div className=\"flex justify-between items-center py-1.5 sm:py-2 border-b border-white/10\">
              <span className=\"text-[#b4b4b4] text-xs sm:text-sm\">Price Impact</span>
              <span className=\"text-[#00ff88] text-xs sm:text-sm\">
                {jupiterRoute ? `${jupiterRoute.priceImpact.toFixed(2)}%` : '0.12%'}
              </span>
            </div>
            <div className=\"flex justify-between items-center py-1.5 sm:py-2\">
              <span className=\"text-[#b4b4b4] text-xs sm:text-sm\">Connection</span>
              <span className={`text-xs sm:text-sm ${jupiterStatus.connected ? 'text-[#00ff88]' : 'text-[#ff00e5]'}`}>
                {jupiterStatus.connected ? 'Live' : 'Mock'}
              </span>
            </div>
          </div>, TrendingUp } from 'lucide-react';
import { Button } from './ui/button';
import { ThresholdDecryptionProgress } from './ThresholdDecryptionProgress';
import { JupiterService } from '../services/jupiter.service';
import { useState, useEffect } from 'react';

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
  const [jupiterRoute, setJupiterRoute] = useState<any>(null);
  const [jupiterStatus, setJupiterStatus] = useState(JupiterService.getInstance().getConnectionStatus());

  useEffect(() => {
    const loadJupiterData = async () => {
      try {
        const jupiter = JupiterService.getInstance();
        const route = await jupiter.getBestRoute(
          'So11111111111111111111111111111111111111112', // SOL
          'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
          '100000000000' // 100 SOL
        );
        setJupiterRoute(route);
        setJupiterStatus(jupiter.getConnectionStatus());
      } catch (error) {
        console.warn('Jupiter integration unavailable:', error);
      }
    };

    loadJupiterData();
    const interval = setInterval(loadJupiterData, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Matched Trades */}
      <Card className="bg-white/5 border border-[#00f0ff]/20 backdrop-blur-xl relative overflow-hidden group hover:border-[#00f0ff]/40 transition-all duration-300">
        {/* Glow effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#00ff88]/5 to-[#00f0ff]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        <div className="relative z-10">
          <div className="p-3 sm:p-6 border-b border-white/10">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-white mb-1 text-base sm:text-lg">Recent Matches</h3>
                <p className="text-[#b4b4b4] text-xs sm:text-sm">Fair clearing price execution</p>
              </div>
              <Badge variant="outline" className="border-[#00ff88]/50 text-[#00ff88] bg-[#00ff88]/10">
                {matchedTrades.length} Trades
              </Badge>
            </div>
          </div>

          <div className="max-h-[300px] overflow-y-auto">
            {matchedTrades.length === 0 ? (
              <div className="p-6 sm:p-12 text-center">
                <TrendingUp className="w-8 h-8 sm:w-12 sm:h-12 text-white/20 mx-auto mb-3 sm:mb-4" />
                <p className="text-[#b4b4b4] text-sm sm:text-base">No matched trades yet</p>
                <p className="text-[#b4b4b4]/70 text-xs sm:text-sm mt-1">Orders will appear here after matching</p>
              </div>
            ) : (
              matchedTrades.map((trade, index) => (
                <motion.div
                  key={trade.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="p-3 sm:p-4 border-b border-white/5 hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2 sm:mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-1 sm:gap-2 mb-1 sm:mb-2">
                        <Shield className="w-3 h-3 sm:w-4 sm:h-4 text-[#00ff88]" />
                        <span className="text-white text-xs sm:text-sm">Trade #{trade.id.toString().slice(-4)}</span>
                      </div>
                      <div className="space-y-0.5 sm:space-y-1 text-xs">
                        <div className="flex items-center gap-1 sm:gap-2">
                          <span className="text-[#b4b4b4]">Buyer:</span>
                          <span className="text-white/70 truncate max-w-[100px] sm:max-w-none">{trade.buyOrder}</span>
                        </div>
                        <div className="flex items-center gap-1 sm:gap-2">
                          <span className="text-[#b4b4b4]">Seller:</span>
                          <span className="text-white/70 truncate max-w-[100px] sm:max-w-none">{trade.sellOrder}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right ml-2">
                      <div className="text-[#00ff88] mb-1 text-sm sm:text-base">${trade.clearingPrice}</div>
                      <div className="text-white/70 text-xs sm:text-sm">{trade.amount}</div>
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
      <Card className="bg-white/5 border border-[#00f0ff]/20 backdrop-blur-xl p-3 sm:p-6 relative overflow-hidden group hover:border-[#00f0ff]/40 transition-all duration-300">
        {/* Glow effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#00f0ff]/5 to-[#ff00e5]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <div className="bg-[#00f0ff]/20 p-1.5 sm:p-2 rounded-lg">
              <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-[#00f0ff]" />
            </div>
            <div>
              <h3 className="text-white text-base sm:text-lg">Jupiter Integration</h3>
              <p className="text-[#b4b4b4] text-xs sm:text-sm">Best route for execution</p>
            </div>
          </div>

          <div className="space-y-2 sm:space-y-3 mb-3 sm:mb-4">
            <div className="flex justify-between items-center py-1.5 sm:py-2 border-b border-white/10">
              <span className="text-[#b4b4b4] text-xs sm:text-sm">Route</span>
              <span className="text-white text-xs sm:text-sm">Raydium → Orca</span>
            </div>
            <div className="flex justify-between items-center py-1.5 sm:py-2 border-b border-white/10">
              <span className="text-[#b4b4b4] text-xs sm:text-sm">Expected Slippage</span>
              <span className="text-[#00ff88] text-xs sm:text-sm">0.04%</span>
            </div>
            <div className="flex justify-between items-center py-1.5 sm:py-2">
              <span className="text-[#b4b4b4] text-xs sm:text-sm">Price Impact</span>
              <span className="text-[#00ff88] text-xs sm:text-sm">0.12%</span>
            </div>
          </div>

          <Button 
            variant="outline" 
            className="w-full border-[#00f0ff]/50 text-[#00f0ff] hover:bg-[#00f0ff]/10 gap-1 sm:gap-2 h-10 sm:h-11 text-sm sm:text-base"
          >
            <span className="hidden sm:inline">View on Solscan</span>
            <span className="sm:hidden">Solscan</span>
            <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}
