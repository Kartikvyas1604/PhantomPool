'use client';

import { useState } from 'react';
import { TrendingUp, BarChart3, PieChart, Activity, Wallet } from 'lucide-react';

interface Trade {
  id: string;
  type: 'buy' | 'sell';
  amount: string;
  price: string;
  timestamp: number;
}

interface Order {
  id: number;
  type: 'buy' | 'sell';
  amount: string;
  price: string;
  status: string;
}

interface TradeExecutionProps {
  matchedTrades: Trade[];
}

export function TradeExecution({ matchedTrades }: TradeExecutionProps) {
  const [selectedTab, setSelectedTab] = useState<'positions' | 'orders' | 'trades'>('positions');

  // Real data only - no mock data
  const positions: { symbol: string; size: number; avgPrice: number; pnl: number; margin: number }[] = [];
  const openOrders: Order[] = [];

  // Transform matched trades to display format - only real trades
  const recentTrades = matchedTrades.map(trade => ({
    id: trade.id,
    symbol: 'SOL/USDC',
    side: trade.type,
    size: trade.amount,
    price: trade.price,
    time: new Date(trade.timestamp).toLocaleTimeString()
  }));

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-[#0a0118] to-[#1a0b2e] border border-cyan-500/20 shadow-2xl relative overflow-hidden">
      {/* Glassmorphism overlay */}
      <div className="absolute inset-0 bg-white/5 backdrop-blur-sm"></div>
      
      {/* Header */}
      <div className="relative z-10 border-b border-cyan-500/20 bg-white/5 backdrop-blur-md px-2 sm:px-4 py-2 sm:py-3">
        <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1 sm:p-2 rounded-lg bg-gradient-to-r from-[#00ff88]/20 to-emerald-500/20 border border-[#00ff88]/30">
              <Wallet className="w-3 h-3 sm:w-4 sm:h-4 text-[#00ff88]" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm md:text-base font-bold text-white">Trade Execution</h3>
              <div className="flex items-center gap-1 sm:gap-2 mt-0.5">
                <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-[#00ff88] rounded-full animate-pulse"></div>
                <span className="text-[#00ff88] text-xs font-medium">Jupiter Routing</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-[#b4b4b4]">Portfolio</div>
            <div className="font-mono text-sm sm:text-base md:text-lg font-bold text-[#00ff88]">
              $0.00
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="relative z-10 border-b border-cyan-500/20 bg-white/5 backdrop-blur-md">
        <div className="flex p-1 sm:p-2 gap-1">
          {(['positions', 'orders', 'trades'] as const).map((tab, index) => {
            const icons = [PieChart, Activity, BarChart3];
            const Icon = icons[index];
            return (
              <button
                key={tab}
                onClick={() => setSelectedTab(tab)}
                className={`flex-1 py-2 sm:py-3 px-1 sm:px-2 text-xs sm:text-sm font-semibold transition-all duration-300 rounded-lg ${
                  selectedTab === tab
                    ? 'text-black bg-[#00f0ff] shadow-lg shadow-[#00f0ff]/30'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                <div className="flex flex-col sm:flex-row items-center justify-center gap-1">
                  <Icon className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden xs:inline">{tab.charAt(0).toUpperCase() + tab.slice(1)}</span>
                  <span className="xs:hidden">{tab.charAt(0).toUpperCase()}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {selectedTab === 'positions' && (
          <div className="h-full relative z-10">
            {positions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-2 sm:px-4 md:px-6">
                <div className="p-3 sm:p-4 md:p-6 rounded-lg sm:rounded-xl md:rounded-2xl bg-white/5 backdrop-blur-md mb-4 sm:mb-6 border border-[#00ff88]/20">
                  <TrendingUp className="w-8 h-8 sm:w-12 sm:h-12 md:w-16 md:h-16 text-[#00ff88] mx-auto mb-2 sm:mb-4 animate-pulse" />
                  <h3 className="text-sm sm:text-lg md:text-xl font-bold text-white mb-2 sm:mb-3">No Positions</h3>
                  <p className="text-xs sm:text-sm text-[#b4b4b4] leading-relaxed">Protected by ZK encryption</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-[#b4b4b4]">
                  <div className="w-1.5 h-1.5 bg-[#00ff88] rounded-full animate-pulse"></div>
                  <span>Ready to trade</span>
                </div>
              </div>
            ) : (
              <div className="p-2 sm:p-4 md:p-6 relative z-10">
                <div className="space-y-2 sm:space-y-4">
                  <div className="grid grid-cols-4 gap-2 sm:gap-4 text-xs sm:text-sm font-semibold text-white pb-2 sm:pb-4 border-b border-cyan-500/20">
                    <div>Symbol</div>
                    <div className="text-right">Size</div>
                    <div className="text-right">Price</div>
                    <div className="text-right">P&L</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {selectedTab === 'orders' && (
          <div className="h-full">
            {openOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <div className="p-6 rounded-2xl bg-gray-800/60 mb-6 border border-gray-600/30">
                  <Activity className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-white mb-3">No Open Orders</h3>
                  <p className="text-gray-400 leading-relaxed">Your pending orders will appear here once you submit them. All orders are encrypted for privacy.</p>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-400">
                  <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
                  <span>Waiting for orders</span>
                </div>
              </div>
            ) : (
              <div className="p-6">
                <div className="space-y-4">
                  {openOrders.map((order) => (
                    <div key={order.id} className="p-4 bg-gray-800/60 rounded-xl border border-gray-600/30 backdrop-blur-sm">
                      <div className="flex justify-between items-start">
                        <div className="space-y-2">
                          <div className={`text-base font-bold ${order.type === 'buy' ? 'text-emerald-400' : 'text-red-400'}`}>
                            {order.type.toUpperCase()} ORDER
                          </div>
                          <div className="text-gray-200 font-mono text-sm">{order.amount} SOL @ ${order.price}</div>
                        </div>
                        <div className={`px-3 py-2 rounded-lg text-sm font-semibold ${
                          order.status === 'pending' 
                            ? 'bg-amber-600/20 text-amber-400 border border-amber-500/30' 
                            : 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                        }`}>
                          {order.status.toUpperCase()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {selectedTab === 'trades' && (
          <div className="h-full">
            {recentTrades.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <div className="p-6 rounded-2xl bg-gray-800/60 mb-6 border border-gray-600/30">
                  <BarChart3 className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-white mb-3">No Trades Executed</h3>
                  <p className="text-gray-400 leading-relaxed">Your completed trades and execution history will appear here. All trades use VRF for fair matching.</p>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-400">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
                  <span>Ready for trade execution</span>
                </div>
              </div>
            ) : (
              <div className="h-full overflow-y-auto">
                <div className="p-6 space-y-4">
                  {recentTrades.map((trade) => (
                    <div key={trade.id} className="p-5 bg-gray-800/60 rounded-xl border border-gray-600/30 backdrop-blur-sm">
                      <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full shadow-lg ${
                            trade.side === 'buy' ? 'bg-emerald-400 shadow-emerald-400/50' : 'bg-red-400 shadow-red-400/50'
                          }`}></div>
                          <span className={`text-base font-bold ${
                            trade.side === 'buy' ? 'text-emerald-400' : 'text-red-400'
                          }`}>
                            {trade.side.toUpperCase()} EXECUTED
                          </span>
                        </div>
                        <span className="text-sm text-gray-400 font-mono">{trade.time}</span>
                      </div>
                      <div className="text-white font-mono text-lg mb-2">
                        {trade.size} SOL @ ${trade.price} USDC
                      </div>
                      <div className="text-sm text-gray-400">
                        Market: {trade.symbol}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}