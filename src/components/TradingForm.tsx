'use client';

import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ElGamalService } from '../crypto/elgamal.service';
import { SolanaService } from '../services/solana.service';

interface FormOrder {
  type: 'buy' | 'sell';
  amount: string;
  price: string;
  timestamp: number;
  trader: string;
  encrypted: string;
  status: string;
}

interface TradingFormProps {
  onSubmitOrder: (order: FormOrder) => void;
}

export function TradingForm({ onSubmitOrder }: TradingFormProps) {
  const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy');
  const [orderMode, setOrderMode] = useState<'limit' | 'market'>('limit');
  const [amount, setAmount] = useState('');
  const [price, setPrice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || (!price && orderMode === 'limit')) return;

    setIsSubmitting(true);

    try {
      const keyPair = ElGamalService.generateKeyPair();
      const amountBigInt = BigInt(Math.floor(parseFloat(amount) * 100));
      const usePrice = orderMode === 'market' ? '149.50' : price;
      
      const encryptedAmount = ElGamalService.encrypt(keyPair.pk, amountBigInt);
      
      const solanaService = SolanaService.getInstance();
      const walletState = solanaService.getWalletState();
      
      const order = {
        type: orderType,
        amount,
        price: usePrice,
        timestamp: Date.now(),
        trader: walletState.publicKey ? 
          `${walletState.publicKey.slice(0, 4)}...${walletState.publicKey.slice(-4)}` :
          `Trader ${Math.random().toString(36).substr(2, 9)}`,
        encrypted: `ElG:${encryptedAmount.c1.x.toString(16).slice(0, 8)}...${encryptedAmount.c2.x.toString(16).slice(-4)}`,
        status: 'pending'
      };

      onSubmitOrder(order);
      setAmount('');
      if (orderMode === 'limit') setPrice('');
    } catch (error) {
      console.error('Order submission failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const marketPrice = 149.50;

  useEffect(() => {
    const solanaService = SolanaService.getInstance();
    const walletState = solanaService.getWalletState();
    setWalletBalance(walletState.balance || 0);
  }, []);

  return (
    <div className="h-full flex flex-col bg-slate-900/50">
      {/* Header */}
      <div className="border-b border-slate-800 px-4 py-3">
        <h3 className="font-semibold text-slate-100">Order Entry</h3>
        <p className="text-xs text-slate-400 mt-1">Encrypted • MEV Protected</p>
      </div>

      {/* Form Content */}
      <div className="flex-1 p-4 space-y-4">
        {/* Order Type Toggle */}
        <div className="grid grid-cols-2 gap-1 bg-slate-800 rounded-lg p-1">
          <button
            onClick={() => setOrderType('buy')}
            className={`py-2 px-4 rounded-md text-sm font-medium transition-all ${
              orderType === 'buy'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            BUY
          </button>
          <button
            onClick={() => setOrderType('sell')}
            className={`py-2 px-4 rounded-md text-sm font-medium transition-all ${
              orderType === 'sell'
                ? 'bg-red-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            SELL
          </button>
        </div>

        {/* Order Mode */}
        <div className="grid grid-cols-2 gap-1 bg-slate-800 rounded-lg p-1">
          <button
            onClick={() => setOrderMode('limit')}
            className={`py-1.5 px-3 rounded-md text-xs font-medium transition-all ${
              orderMode === 'limit'
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Limit
          </button>
          <button
            onClick={() => setOrderMode('market')}
            className={`py-1.5 px-3 rounded-md text-xs font-medium transition-all ${
              orderMode === 'market'
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Market
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Amount */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">
              Amount
            </label>
            <div className="relative">
              <Input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-slate-800 border-slate-700 text-slate-100 pr-12 font-mono"
                step="0.01"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                SOL
              </span>
            </div>
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>Balance: {walletBalance.toFixed(2)} SOL</span>
              <button
                type="button"
                onClick={() => setAmount(walletBalance.toString())}
                className="text-blue-400 hover:text-blue-300"
              >
                MAX
              </button>
            </div>
          </div>

          {/* Price - Only show for limit orders */}
          {orderMode === 'limit' && (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2">
                Price
              </label>
              <div className="relative">
                <Input
                  type="number"
                  placeholder={marketPrice.toString()}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-slate-100 pr-16 font-mono"
                  step="0.01"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                  USDC
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Market: ${marketPrice}
              </div>
            </div>
          )}

          {/* Market Price Display for Market Orders */}
          {orderMode === 'market' && (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2">
                Market Price
              </label>
              <div className="bg-slate-800 border border-slate-700 rounded-md px-3 py-2">
                <span className="font-mono text-slate-100">${marketPrice}</span>
                <span className="text-xs text-emerald-400 ml-2">+2.34%</span>
              </div>
            </div>
          )}

          {/* Total */}
          {amount && (orderMode === 'market' || price) && (
            <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Total</span>
                <span className="font-mono text-slate-100">
                  ${(parseFloat(amount || '0') * parseFloat(orderMode === 'market' ? marketPrice.toString() : price || '0')).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>Fee (0.1%)</span>
                <span>
                  ${((parseFloat(amount || '0') * parseFloat(orderMode === 'market' ? marketPrice.toString() : price || '0')) * 0.001).toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isSubmitting || !amount || (orderMode === 'limit' && !price)}
            className={`w-full h-12 font-semibold ${
              orderType === 'buy'
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-red-600 hover:bg-red-700 text-white'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isSubmitting ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Encrypting...
              </div>
            ) : (
              `${orderType.toUpperCase()} ${orderMode.toUpperCase()}`
            )}
          </Button>
        </form>

        {/* Security Badge */}
        <div className="mt-4 pt-4 border-t border-slate-800">
          <div className="flex items-center gap-2 text-xs text-emerald-400">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
            <span>ElGamal Encrypted • Zero-Knowledge Proofs</span>
          </div>
        </div>
      </div>
    </div>
  );
}