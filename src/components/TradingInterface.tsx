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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
      {/* Order Entry - Full width on mobile, left on larger screens */}
      <div className="col-span-1 md:col-span-2 lg:col-span-1 order-1">
        <TradingForm onSubmitOrder={onAddOrder} />
      </div>

      {/* Order Book - Full width on mobile, right on medium, center on large */}
      <div className="col-span-1 md:col-span-2 lg:col-span-1 order-2 md:order-3 lg:order-2">
        <OrderBookList orders={orders} isMatching={isMatching} />
      </div>

      {/* Trade Execution - Full width on mobile, left on medium, right on large */}
      <div className="col-span-1 md:col-span-2 lg:col-span-1 order-3 md:order-2 lg:order-3">
        <TradeExecution matchedTrades={matchedTrades} />
      </div>
    </div>
  );
}
