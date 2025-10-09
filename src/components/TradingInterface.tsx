'use client';

import { TradingForm } from './TradingForm';
import { OrderBookList } from './OrderBookList';
import { TradeExecution } from './TradeExecution';

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

interface TradingInterfaceProps {
  orders: Order[];
  matchedTrades: Trade[];
  isMatching: boolean;
  onAddOrder: (order: Omit<Order, 'id'>) => void;
}

export function TradingInterface({ 
  orders, 
  matchedTrades, 
  isMatching, 
  onAddOrder 
}: TradingInterfaceProps) {
  return (
    <div className="h-full flex">
      {/* Left Sidebar - Order Entry */}
      <div className="w-80 border-r border-slate-800 bg-slate-900/30">
        <TradingForm onSubmitOrder={onAddOrder} />
      </div>

      {/* Center - Order Book */}
      <div className="flex-1 border-r border-slate-800">
        <OrderBookList orders={orders} isMatching={isMatching} />
      </div>

      {/* Right Sidebar - Trade Execution & Positions */}
      <div className="w-80 bg-slate-900/30">
        <TradeExecution matchedTrades={matchedTrades} />
      </div>
    </div>
  );
}
