'use client';

import { TradingForm } from './TradingForm';
import { OrderBookList } from './OrderBookList';
import { TradeExecution } from './TradeExecution';

interface TradingInterfaceProps {
  orders: any[];
  matchedTrades: any[];
  isMatching: boolean;
  onAddOrder: (order: any) => void;
}

export function TradingInterface({ 
  orders, 
  matchedTrades, 
  isMatching, 
  onAddOrder 
}: TradingInterfaceProps) {
  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Left Column - Order Entry */}
      <div className="lg:col-span-1">
        <TradingForm onSubmitOrder={onAddOrder} />
      </div>

      {/* Center Column - Order Book */}
      <div className="lg:col-span-1">
        <OrderBookList orders={orders} isMatching={isMatching} />
      </div>

      {/* Right Column - Trade Execution */}
      <div className="lg:col-span-1">
        <TradeExecution matchedTrades={matchedTrades} />
      </div>
    </div>
  );
}
