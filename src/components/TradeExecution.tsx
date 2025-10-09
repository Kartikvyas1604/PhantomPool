'use client';

import { useState } from 'react';
import { TrendingUp, ExternalLink, Settings, BarChart3 } from 'lucide-react';
import { Button } from './ui/button';

interface Trade {
  id: string;
  type: 'buy' | 'sell';
  amount: string;
  price: string;
  timestamp: number;
}

interface TradeExecutionProps {
  matchedTrades: Trade[];
}

export function TradeExecution({ matchedTrades }: TradeExecutionProps) {
  const [selectedTab, setSelectedTab] = useState<'positions' | 'orders' | 'trades'>('positions');

  // Mock data for positions
  const positions = [
    { symbol: 'SOL', size: 0, avgPrice: 0, pnl: 0, margin: 0 }
  ];

  const openOrders = [];

  // Transform matched trades to display format
  const recentTrades = matchedTrades.length > 0 
    ? matchedTrades.map(trade => ({
        id: trade.id,
        symbol: 'SOL/USDC',
        side: trade.type,
        size: trade.amount,
        price: trade.price,
        time: new Date(trade.timestamp).toLocaleTimeString()
      }))
    : [
        { id: '1', symbol: 'SOL/USDC', side: 'buy', size: '10.50', price: '149.45', time: '14:32:15' },
        { id: '2', symbol: 'SOL/USDC', side: 'sell', size: '5.25', price: '149.60', time: '14:31:42' },
        { id: '3', symbol: 'SOL/USDC', side: 'buy', size: '25.00', price: '149.35', time: '14:30:18' },
      ];

  return (
    <div className="h-full flex flex-col bg-slate-900/50">
      {/* Header */}
      <div className="border-b border-slate-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-100">Portfolio</h3>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              <Settings className="w-3 h-3" />
            </Button>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              <BarChart3 className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Account Summary */}
      <div className="px-4 py-3 border-b border-slate-800 bg-slate-800/30">
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-slate-400">Portfolio Value</span>
            <div className="text-lg font-mono text-slate-100 mt-0.5">$0.00</div>
          </div>
          <div>
            <span className="text-slate-400">P&L (24h)</span>
            <div className="text-lg font-mono text-slate-400 mt-0.5">$0.00</div>
          </div>
          <div>
            <span className="text-slate-400">Available</span>
            <div className="text-sm font-mono text-slate-200 mt-0.5">0.00 USDC</div>
          </div>
          <div>
            <span className="text-slate-400">Margin Used</span>
            <div className="text-sm font-mono text-slate-200 mt-0.5">0.00%</div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-slate-800 bg-slate-800/30">
        <div className="flex">
          {[
            { id: 'positions', label: 'Positions', count: positions.length },
            { id: 'orders', label: 'Orders', count: openOrders.length },
            { id: 'trades', label: 'Trades', count: recentTrades.length }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id as 'positions' | 'orders' | 'trades')}
              className={`flex-1 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                selectedTab === tab.id
                  ? 'border-blue-400 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {selectedTab === 'positions' && (
          <div className="h-full">
            {positions[0].size === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <TrendingUp className="w-12 h-12 text-slate-600 mb-4" />
                <p className="text-sm text-slate-400 mb-2">No open positions</p>
                <p className="text-xs text-slate-500">Submit an order to start trading</p>
              </div>
            ) : (
              <div className="p-4">
                <div className="space-y-2">
                  <div className="grid grid-cols-4 gap-2 text-xs font-medium text-slate-400 pb-2 border-b border-slate-800">
                    <div>Symbol</div>
                    <div className="text-right">Size</div>
                    <div className="text-right">Avg Price</div>
                    <div className="text-right">P&L</div>
                  </div>
                  {/* Position rows would go here */}
                </div>
              </div>
            )}
          </div>
        )}

        {selectedTab === 'orders' && (
          <div className="h-full">
            {openOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="w-12 h-12 bg-slate-800 rounded-lg flex items-center justify-center mb-4">
                  <div className="w-6 h-6 border-2 border-slate-600 rounded"></div>
                </div>
                <p className="text-sm text-slate-400 mb-2">No open orders</p>
                <p className="text-xs text-slate-500">Place your first order</p>
              </div>
            ) : (
              <div className="p-4">
                {/* Orders would be listed here */}
              </div>
            )}
          </div>
        )}

        {selectedTab === 'trades' && (
          <div className="h-full overflow-y-auto">
            <div className="p-4">
              <div className="space-y-2">
                <div className="grid grid-cols-5 gap-2 text-xs font-medium text-slate-400 pb-2 border-b border-slate-800">
                  <div>Time</div>
                  <div>Symbol</div>
                  <div>Side</div>
                  <div className="text-right">Size</div>
                  <div className="text-right">Price</div>
                </div>
                {recentTrades.map((trade) => (
                  <div
                    key={trade.id}
                    className="grid grid-cols-5 gap-2 text-xs py-2 hover:bg-slate-800/50 rounded transition-colors"
                  >
                    <div className="text-slate-400 font-mono">{trade.time}</div>
                    <div className="text-slate-200">{trade.symbol}</div>
                    <div className={`font-medium ${
                      trade.side === 'buy' ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {trade.side.toUpperCase()}
                    </div>
                    <div className="text-right text-slate-200 font-mono">{trade.size}</div>
                    <div className="text-right text-slate-200 font-mono">${trade.price}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Jupiter Integration */}
      <div className="border-t border-slate-800 p-4">
        <div className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 rounded-lg p-3 border border-purple-800/30">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-purple-300">Jupiter DEX</div>
              <div className="text-xs text-slate-400 mt-0.5">Best execution routing</div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-purple-300 hover:text-purple-200 h-8 px-3"
            >
              <span className="text-xs mr-1">Trade</span>
              <ExternalLink className="w-3 h-3" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-3 text-xs">
            <div>
              <span className="text-slate-500">Expected Output</span>
              <div className="text-purple-300 font-mono mt-0.5">666.65 USDC</div>
            </div>
            <div>
              <span className="text-slate-500">Price Impact</span>
              <div className="text-emerald-400 font-mono mt-0.5">-5.25%</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}