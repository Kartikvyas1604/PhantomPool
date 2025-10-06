'use client';

import { motion } from 'motion/react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { ExternalLink, TrendingUp } from 'lucide-react';
import { Button } from './ui/button';
import { useState, useEffect } from 'react';

interface TradeExecutionProps {
  isExecuting?: boolean;
  onExecute?: () => void;
  matchedTrades?: any[];
}

export const TradeExecution = ({ isExecuting = false, onExecute, matchedTrades = [] }: TradeExecutionProps) => {
  const [status, setStatus] = useState('Ready');

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
              <span className="text-white text-sm">Raydium → Orca</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-white/10">
              <span className="text-[#b4b4b4] text-sm">Expected Output</span>
              <span className="text-[#00ff88] text-sm">14,950 USDC</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-[#b4b4b4] text-sm">Price Impact</span>
              <span className="text-[#00ff88] text-sm">0.12%</span>
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
