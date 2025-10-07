'use client';

import { motion } from 'motion/react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { ExternalLink, TrendingUp } from 'lucide-react';
import { Button } from './ui/button';
import { useState, useEffect } from 'react';
import { JupiterService } from '../services/jupiter.service';

interface TradeExecutionProps {
  isExecuting?: boolean;
  onExecute?: () => void;
  matchedTrades?: any[];
}

export const TradeExecution = ({ isExecuting = false, onExecute, matchedTrades = [] }: TradeExecutionProps) => {
  const [status, setStatus] = useState('Ready');
  const [routeData, setRouteData] = useState({
    route: 'Raydium → Orca',
    expectedOutput: '14,950 USDC',
    priceImpact: '0.12%'
  });

  useEffect(() => {
    const fetchJupiterData = async () => {
      try {
        const jupiterService = JupiterService.getInstance();
        const quote = await jupiterService.getQuote(
          'So11111111111111111111111111111111111111112',
          'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          '100000000000',
          50
        );

        const route = quote.marketInfos.map(m => m.label).join(' → ') || 'Raydium → Orca';
        const outputAmount = parseFloat(quote.outAmount) / 1000000;
        const priceImpact = (quote.priceImpactPct * 100).toFixed(2);

        setRouteData({
          route,
          expectedOutput: `${outputAmount.toLocaleString()} USDC`,
          priceImpact: `${priceImpact}%`
        });
      } catch (error) {
        console.error('Failed to fetch Jupiter data:', error);
      }
    };

    fetchJupiterData();
    const interval = setInterval(fetchJupiterData, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Card className="bg-gradient-to-b from-black to-gray-900 border border-white/20 shadow-2xl">
      <div className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">Trade Execution</h3>
          <Badge variant="outline" className="text-[#00ff88] border-[#00ff88]">
            Jupiter DEX
          </Badge>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center py-2 border-b border-white/10">
              <span className="text-[#b4b4b4] text-sm">Route</span>
              <span className="text-white text-sm">{routeData.route}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-white/10">
              <span className="text-[#b4b4b4] text-sm">Expected Output</span>
              <span className="text-[#00ff88] text-sm">{routeData.expectedOutput}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-[#b4b4b4] text-sm">Price Impact</span>
              <span className="text-[#00ff88] text-sm">{routeData.priceImpact}</span>
            </div>
          </div>

          <div className="pt-4 border-t border-white/10">
            <div className="flex gap-3">
              <Button 
                onClick={onExecute}
                disabled={isExecuting}
                className="flex-1 bg-gradient-to-r from-[#00ff88] to-[#00cc6a] hover:from-[#00e676] hover:to-[#00b356] text-black font-semibold"
              >
                {isExecuting ? 'Executing...' : 'Execute Trade'}
              </Button>
              <Button 
                variant="outline" 
                className="border-white/20 text-white hover:bg-white/10"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Jupiter
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
