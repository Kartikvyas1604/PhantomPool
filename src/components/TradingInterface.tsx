'use client';

import { TradingForm } from './TradingForm';
import { OrderBookList } from './OrderBookList';
import { TradeExecution } from './TradeExecution';
import { TrendingUp } from 'lucide-react';

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

interface Trade {
  id: string;
  type: 'buy' | 'sell';
  amount: string;
  price: string;
  timestamp: number;
}

interface FormOrder {
  type: 'buy' | 'sell';
  amount: string;
  price: string;
  trader: string;
  status: string;
}

interface TradingInterfaceProps {
  orders: Order[];
  matchedTrades: Trade[];
  isMatching: boolean;
  onAddOrder: (order: FormOrder) => void;
}

export function TradingInterface({ 
  orders, 
  matchedTrades, 
  isMatching, 
  onAddOrder 
}: TradingInterfaceProps) {
  return (
    <div className="h-full w-full bg-gradient-to-br from-[#0a0118] via-[#1a0b2e] to-[#0a0118] relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5"></div>
      <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-[#00f0ff]/10 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-32 h-32 bg-[#ff00e5]/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      
      {/* Ultra Mobile Layout (< 475px) - Single Panel with Tabs */}
      <div className="h-full flex flex-col xs:hidden">
        {/* Ultra Mobile Tab Selector */}
        <div className="bg-white/5 backdrop-blur-md border-b border-cyan-500/20 p-1">
          <div className="flex gap-0.5">
            {[
              { key: 'trade', label: 'Trade', icon: TrendingUp },
              { key: 'book', label: 'Book', icon: null },
              { key: 'exec', label: 'Exec', icon: null }
            ].map(tab => (
              <button
                key={tab.key}
                className="flex-1 py-2 text-xs font-bold text-white/70 hover:text-white transition-colors"
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        
        {/* Ultra Mobile Content - Only Trading Form for now */}
        <div className="flex-1 min-h-0">
          <TradingForm onSubmitOrder={onAddOrder} />
        </div>
      </div>

      {/* Small Mobile Layout (475px - 640px) - Stack Vertically */}
      <div className="h-full hidden xs:flex sm:hidden flex-col gap-0.5 p-0.5">
        <div className="flex-1 min-h-0">
          <TradingForm onSubmitOrder={onAddOrder} />
        </div>
        <div className="flex-1 min-h-0">
          <OrderBookList orders={orders} isMatching={isMatching} />
        </div>
        <div className="flex-1 min-h-0">
          <TradeExecution matchedTrades={matchedTrades} />
        </div>
      </div>

      {/* Medium Mobile Layout (640px - 1024px) - 2x2 Grid */}
      <div className="h-full hidden sm:grid lg:hidden grid-cols-2 grid-rows-2 gap-1 p-1">
        <div className="col-span-1 row-span-1">
          <TradingForm onSubmitOrder={onAddOrder} />
        </div>
        <div className="col-span-1 row-span-1">
          <TradeExecution matchedTrades={matchedTrades} />
        </div>
        <div className="col-span-2 row-span-1">
          <OrderBookList orders={orders} isMatching={isMatching} />
        </div>
      </div>

      {/* Desktop Layout (>= 1024px) - 3 Column */}
      <div className="hidden lg:flex h-full gap-2 p-2">
        <div className="w-1/3 min-w-[320px] max-w-[400px]">
          <TradingForm onSubmitOrder={onAddOrder} />
        </div>
        <div className="flex-1 min-w-[300px]">
          <OrderBookList orders={orders} isMatching={isMatching} />
        </div>
        <div className="w-1/3 min-w-[320px] max-w-[400px]">
          <TradeExecution matchedTrades={matchedTrades} />
        </div>
      </div>
    </div>
  );
}
