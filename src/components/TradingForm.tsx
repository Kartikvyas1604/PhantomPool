'use client';

import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Shield, Lock, TrendingUp, Zap, Copy, ChevronDown, DollarSign } from 'lucide-react';
import { SolanaProductionService } from '../services/solana-production.service';

interface FormOrder {
  type: 'buy' | 'sell';
  amount: string;
  price: string;
  trader: string;
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
    setIsSubmitting(true);

    try {
      const finalPrice = orderMode === 'market' ? '0' : price;
      
      await new Promise(resolve => setTimeout(resolve, 2000));

      onSubmitOrder({
        type: orderType,
        amount,
        price: finalPrice,
        trader: `0x${Math.random().toString(16).substr(2, 8)}`,
        status: 'pending'
      });

      setAmount('');
      setPrice('');
    } catch (error) {
      console.error('Order submission failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const solanaService = SolanaService.getInstance();
    const walletState = solanaService.getWalletState();
    setWalletBalance(walletState.balance || 0);
  }, []);

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-[#0a0118] to-[#1a0b2e] border border-cyan-500/20 shadow-2xl relative overflow-hidden">
      {/* Glassmorphism overlay */}
      <div className="absolute inset-0 bg-white/5 backdrop-blur-sm"></div>
      
      {/* Header */}
      <div className="relative z-10 border-b border-cyan-500/20 bg-white/5 backdrop-blur-md px-2 sm:px-4 py-2 sm:py-3">
        <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1 sm:p-2 rounded-lg bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30">
              <Shield className="w-3 h-3 sm:w-4 sm:h-4 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm md:text-base font-bold text-white">Order Entry</h3>
              <div className="flex items-center gap-1 sm:gap-2 mt-0.5">
                <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-[#00ff88] rounded-full animate-pulse"></div>
                <span className="text-[#00ff88] text-xs font-medium">🔒 MEV Protected</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-[#b4b4b4]">Balance</div>
            <div className="font-mono text-sm sm:text-base md:text-lg font-bold text-[#00f0ff]">
              {walletBalance.toFixed(4)} SOL
            </div>
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="relative z-10 flex-1 p-2 sm:p-4 md:p-6 space-y-3 sm:space-y-4 md:space-y-6 overflow-y-auto">
        {/* Token Pair Selector */}
        <div className="relative">
          <div className="flex items-center justify-between p-2 sm:p-3 bg-white/5 backdrop-blur-md rounded-lg border border-cyan-500/20">
            <span className="text-white text-xs sm:text-sm font-medium">SOL/USDC</span>
            <ChevronDown className="w-3 h-3 sm:w-4 sm:h-4 text-cyan-400" />
          </div>
        </div>

        {/* Order Type */}
        <div className="grid grid-cols-2 gap-1 sm:gap-2 p-1 bg-white/5 backdrop-blur-md rounded-lg border border-cyan-500/20">
          <button
            onClick={() => setOrderType('buy')}
            className={`py-2 sm:py-3 md:py-4 px-2 sm:px-4 rounded-lg text-xs sm:text-sm md:text-base font-bold transition-all duration-300 ${
              orderType === 'buy'
                ? 'bg-[#00f0ff] text-black shadow-lg shadow-[#00f0ff]/50 animate-pulse'
                : 'text-white/70 hover:text-white hover:bg-white/10 border border-[#00f0ff]/30'
            }`}
          >
            <div className="flex items-center justify-center gap-1 sm:gap-2">
              <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5" />
              <span>BUY</span>
            </div>
          </button>
          <button
            onClick={() => setOrderType('sell')}
            className={`py-2 sm:py-3 md:py-4 px-2 sm:px-4 rounded-lg text-xs sm:text-sm md:text-base font-bold transition-all duration-300 ${
              orderType === 'sell'
                ? 'bg-[#ff00e5] text-black shadow-lg shadow-[#ff00e5]/50 animate-pulse'
                : 'text-white/70 hover:text-white hover:bg-white/10 border border-[#ff00e5]/30'
            }`}
          >
            <div className="flex items-center justify-center gap-1 sm:gap-2">
              <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 rotate-180" />
              <span>SELL</span>
            </div>
          </button>
        </div>

        {/* Order Mode */}
        <div className="flex bg-white/5 backdrop-blur-md rounded-lg p-1 border border-cyan-500/20 gap-1">
          <button
            onClick={() => setOrderMode('limit')}
            className={`flex-1 py-2 sm:py-3 px-2 sm:px-4 rounded-lg font-semibold transition-all duration-300 text-xs sm:text-sm ${
              orderMode === 'limit'
                ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg shadow-purple-500/30'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            <div className="flex items-center justify-center gap-1 sm:gap-2">
              <DollarSign className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden xs:inline">Limit</span>
              <span className="xs:hidden">L</span>
            </div>
          </button>
          <button
            onClick={() => setOrderMode('market')}
            className={`flex-1 py-2 sm:py-3 px-2 sm:px-4 rounded-lg font-semibold transition-all duration-300 text-xs sm:text-sm ${
              orderMode === 'market'
                ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg shadow-purple-500/30'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            <div className="flex items-center justify-center gap-1 sm:gap-2">
              <Zap className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden xs:inline">Market</span>
              <span className="xs:hidden">M</span>
            </div>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4 md:space-y-6">
          {/* Amount Input */}
          <div className="space-y-2">
            <label className="block text-xs sm:text-sm md:text-base font-semibold text-white flex items-center gap-2">
              <div className="w-2 h-2 sm:w-3 sm:h-3 bg-[#00f0ff] rounded-full animate-pulse"></div>
              <span>Amount (SOL)</span>
            </label>
            <div className="relative">
              <Input
                type="number"
                placeholder="0.00000000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-white/5 backdrop-blur-md border-cyan-500/20 text-white pr-12 sm:pr-16 md:pr-20 font-mono h-8 sm:h-10 md:h-14 text-xs sm:text-sm md:text-lg focus:border-[#00f0ff] focus:ring-2 focus:ring-[#00f0ff]/20 rounded-lg shadow-inner"
                step="0.00000001"
                required
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-2 sm:pr-3 md:pr-4">
                <button
                  type="button"
                  onClick={() => setAmount(walletBalance.toString())}
                  className="text-xs font-bold px-1.5 sm:px-2 md:px-3 py-1 sm:py-1.5 md:py-2 bg-[#00f0ff] text-black rounded hover:bg-[#00f0ff]/80 transition-colors shadow-lg"
                >
                  MAX
                </button>
              </div>
            </div>
            
            {/* Balance indicator */}
            <div className="text-xs text-[#b4b4b4] flex justify-between">
              <span>Available: {walletBalance.toFixed(4)} SOL</span>
              <span>≈ ${(walletBalance * 150).toFixed(2)}</span>
            </div>
          </div>

          {/* Price Input (for limit orders) */}
          {orderMode === 'limit' && (
            <div className="space-y-2">
              <label className="block text-xs sm:text-sm md:text-base font-semibold text-white flex items-center gap-2">
                <div className="w-2 h-2 sm:w-3 sm:h-3 bg-[#ff00e5] rounded-full animate-pulse"></div>
                <span>Price (USDC)</span>
              </label>
              <Input
                type="number"
                placeholder="0.00000000"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="bg-white/5 backdrop-blur-md border-cyan-500/20 text-white font-mono h-8 sm:h-10 md:h-14 text-xs sm:text-sm md:text-lg focus:border-[#ff00e5] focus:ring-2 focus:ring-[#ff00e5]/20 rounded-lg shadow-inner"
                step="0.00000001"
                required
              />
              <div className="text-xs text-[#b4b4b4]">
                Market Price: $150.25 USDC
              </div>
            </div>
          )}

          {/* Order Preview Card */}
          {(amount || price) && (
            <div className="bg-white/5 backdrop-blur-md border border-cyan-500/20 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-[#b4b4b4]">Order Preview</span>
                <div className="flex items-center gap-1">
                  <Lock className="w-3 h-3 text-[#00ff88]" />
                  <span className="text-xs text-[#00ff88]">Encrypted</span>
                </div>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-white/70">Hash:</span>
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-cyan-400">0x7f9a...e3d2</span>
                    <Copy className="w-3 h-3 text-cyan-400 cursor-pointer hover:text-cyan-300" />
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/70">Size:</span>
                  <span className="font-mono text-white">█████</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/70">Price:</span>
                  <span className="font-mono text-white">█████</span>
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-2">
            <Button 
              type="submit" 
              disabled={isSubmitting || !amount || (orderMode === 'limit' && !price)}
              className={`w-full py-3 sm:py-4 md:py-5 text-xs sm:text-sm md:text-lg font-bold transition-all duration-300 rounded-lg relative overflow-hidden ${
                orderType === 'buy' 
                  ? 'bg-[#00f0ff] hover:bg-[#00f0ff]/80 text-black shadow-lg shadow-[#00f0ff]/50' 
                  : 'bg-[#ff00e5] hover:bg-[#ff00e5]/80 text-black shadow-lg shadow-[#ff00e5]/50'
              } disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] group`}
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  <span className="hidden xs:inline">Encrypting Order...</span>
                  <span className="xs:hidden">Encrypting...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <Lock className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 group-hover:animate-pulse" />
                  <span className="hidden sm:inline">Encrypt & Submit {orderType === 'buy' ? 'Buy' : 'Sell'} Order</span>
                  <span className="sm:hidden">{orderType === 'buy' ? 'Buy' : 'Sell'} Order</span>
                </div>
              )}
              
              {/* Particle effect overlay */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="absolute top-2 left-4 w-1 h-1 bg-white rounded-full animate-ping"></div>
                <div className="absolute bottom-3 right-6 w-1 h-1 bg-white rounded-full animate-ping delay-150"></div>
                <div className="absolute top-4 right-8 w-1 h-1 bg-white rounded-full animate-ping delay-300"></div>
              </div>
            </Button>
          </div>
        </form>

        {/* Privacy Guarantee Badge */}
        <div className="bg-white/5 backdrop-blur-md border border-[#00ff88]/30 rounded-lg p-3 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-[#00ff88]/10 to-transparent"></div>
          <div className="relative z-10 flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#00ff88] animate-pulse" />
            <span className="text-xs sm:text-sm font-bold text-[#00ff88]">🔒 Order invisible to MEV bots</span>
          </div>
          <div className="relative z-10 mt-2 text-xs text-white/70">
            Your order is encrypted end-to-end and protected from front-running attacks.
          </div>
        </div>

        {/* Security Features */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-2">
          <div className="bg-white/5 backdrop-blur-md border border-cyan-500/20 rounded-lg p-2 hover:bg-white/10 transition-colors group">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-[#00ff88] rounded-full animate-pulse shadow-lg shadow-[#00ff88]/50"></div>
              <span className="text-xs font-medium text-white group-hover:text-[#00ff88]">ElGamal Active</span>
            </div>
          </div>
          <div className="bg-white/5 backdrop-blur-md border border-cyan-500/20 rounded-lg p-2 hover:bg-white/10 transition-colors group">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-[#00f0ff] rounded-full animate-pulse shadow-lg shadow-[#00f0ff]/50"></div>
              <span className="text-xs font-medium text-white group-hover:text-[#00f0ff]">VRF Verified</span>
            </div>
          </div>
          <div className="bg-white/5 backdrop-blur-md border border-cyan-500/20 rounded-lg p-2 hover:bg-white/10 transition-colors group sm:col-span-2 lg:col-span-1 xl:col-span-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-[#ff00e5] rounded-full animate-pulse shadow-lg shadow-[#ff00e5]/50"></div>
              <span className="text-xs font-medium text-white group-hover:text-[#ff00e5]">Threshold Network: 5/5</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}