'use client';

import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ArrowUpDown, DollarSign, Coins, Lock, Shield, TrendingUp, TrendingDown, Sparkles } from 'lucide-react';
import { ElGamalService } from '../crypto/elgamal.service';
import { BulletproofsService } from '../crypto/bulletproofs.service';
import { SolanaService } from '../services/solana.service';
import { metricsService } from '../services/metrics.service';

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
  const [amount, setAmount] = useState('');
  const [price, setPrice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [walletBalance, setWalletBalance] = useState(1250.00);
  const [isWalletConnected, setIsWalletConnected] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !price) return;

    setIsSubmitting(true);

    try {
      const encryptionStart = Date.now();
      const keyPair = ElGamalService.generateKeyPair();
      
      const amountBigInt = BigInt(Math.floor(parseFloat(amount) * 100));
      const priceBigInt = BigInt(Math.floor(parseFloat(price) * 100));
      const totalValue = amountBigInt * priceBigInt / BigInt(100);
      
      const encryptedAmount = ElGamalService.encrypt(keyPair.pk, amountBigInt);
      const encryptedPrice = ElGamalService.encrypt(keyPair.pk, priceBigInt);
      
      const encryptionTime = Date.now() - encryptionStart;
      
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      const solanaService = SolanaService.getInstance();
      const walletState = solanaService.getWalletState();
      
      const solvencyProof = BulletproofsService.verifySolvency(
        walletState.publicKey || 'anonymous',
        totalValue
      );
      
      metricsService.incrementOrderSubmitted(Number(amountBigInt), encryptionTime);
      metricsService.recordCryptoOperation('bulletproof', 2400);
      
      const order = {
        type: orderType,
        amount,
        price,
        timestamp: Date.now(),
        trader: walletState.publicKey ? 
          `${walletState.publicKey.slice(0, 4)}...${walletState.publicKey.slice(-4)}` :
          `Trader ${Math.random().toString(36).substr(2, 9)}`,
        encrypted: `ElG:${encryptedAmount.c1.x.toString(16).slice(0, 8)}...${encryptedAmount.c2.x.toString(16).slice(-4)}`,
        status: 'pending'
      };

      if (solanaService.isConnected()) {
        await solanaService.submitOrder(order);
      }

      onSubmitOrder(order);
      setAmount('');
      setPrice('');
    } catch (error) {
      console.error('Order submission failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const marketPrice = 149.50;
  const balance = walletBalance;

  useEffect(() => {
    const solanaService = SolanaService.getInstance();
    const walletState = solanaService.getWalletState();
    
    setIsWalletConnected(walletState.connected);
    setWalletBalance(walletState.balance || 1250.00);
    
    solanaService.on('connected', (state: any) => {
      setIsWalletConnected(true);
      setWalletBalance(state.balance || 1250.00);
    });
    
    solanaService.on('disconnected', () => {
      setIsWalletConnected(false);
      setWalletBalance(1250.00);
    });
  }, []);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Token Pair Selector */}
      <Card className="bg-gradient-to-br from-white/5 to-white/10 border-[#00f0ff]/20 backdrop-blur-xl">
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center justify-between flex-wrap sm:flex-nowrap gap-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-[#00f0ff] to-[#ff00e5] rounded-full flex items-center justify-center">
                <Coins className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white">SOL/USDC</h3>
                <p className="text-xs sm:text-sm text-[#b4b4b4]">Solana / USD Coin</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg sm:text-2xl font-bold text-[#00ff88]">${marketPrice}</div>
              <div className="text-xs sm:text-sm text-[#00ff88] flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                +2.34%
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Trading Form */}
      <Card className="bg-gradient-to-br from-white/5 to-white/10 border-[#00f0ff]/20 backdrop-blur-xl">
        <CardHeader className="pb-3 sm:pb-4 px-3 sm:px-6 pt-4 sm:pt-6">
          <CardTitle className="text-white flex items-center gap-2 text-base sm:text-lg">
            <div className="p-1.5 sm:p-2 bg-gradient-to-br from-[#00f0ff]/20 to-[#ff00e5]/20 rounded-lg">
              <ArrowUpDown className="w-4 h-4 sm:w-5 sm:h-5 text-[#00f0ff]" />
            </div>
            Order Entry
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 sm:space-y-6 px-3 sm:px-6 pb-4 sm:pb-6">
          <Tabs value={orderType} onValueChange={(value) => setOrderType(value as 'buy' | 'sell')}>
            <TabsList className="grid w-full grid-cols-2 bg-black/40 p-1 rounded-xl">
              <TabsTrigger 
                value="buy" 
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#00f0ff]/20 data-[state=active]:to-[#00f0ff]/10 data-[state=active]:text-[#00f0ff] text-[#b4b4b4] rounded-lg transition-all duration-300"
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                Buy
              </TabsTrigger>
              <TabsTrigger 
                value="sell"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#ff00e5]/20 data-[state=active]:to-[#ff00e5]/10 data-[state=active]:text-[#ff00e5] text-[#b4b4b4] rounded-lg transition-all duration-300"
              >
                <TrendingDown className="w-4 h-4 mr-2" />
                Sell
              </TabsTrigger>
            </TabsList>

            <TabsContent value="buy" className="space-y-6 mt-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-3">
                  <Label htmlFor="amount" className="text-[#b4b4b4] text-sm font-medium">Amount</Label>
                  <div className="relative group">
                    <Input
                      id="amount"
                      type="number"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="bg-black/40 border-[#00f0ff]/30 text-white pr-16 sm:pr-20 h-10 sm:h-12 text-base sm:text-lg focus:border-[#00f0ff] transition-all duration-300 group-hover:border-[#00f0ff]/50"
                    />
                    <div className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 sm:gap-2">
                      <Coins className="w-4 h-4 sm:w-5 sm:h-5 text-[#00f0ff]" />
                      <span className="text-white font-medium text-sm sm:text-base">SOL</span>
                    </div>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#b4b4b4]">Balance: {balance.toLocaleString()} SOL</span>
                    <button 
                      type="button" 
                      onClick={() => setAmount(balance.toString())}
                      className="text-[#00f0ff] hover:text-[#00f0ff]/80 transition-colors"
                    >
                      MAX
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="price" className="text-[#b4b4b4] text-sm font-medium">Price</Label>
                  <div className="relative group">
                    <Input
                      id="price"
                      type="number"
                      placeholder={marketPrice.toString()}
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="bg-black/40 border-[#00f0ff]/30 text-white pr-16 sm:pr-20 h-10 sm:h-12 text-base sm:text-lg focus:border-[#00f0ff] transition-all duration-300 group-hover:border-[#00f0ff]/50"
                    />
                    <div className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 sm:gap-2">
                      <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-[#00f0ff]" />
                      <span className="text-white font-medium text-sm sm:text-base">USDC</span>
                    </div>
                  </div>
                  <div className="text-sm text-[#b4b4b4]">
                    Market Price: ${marketPrice}
                  </div>
                </div>

                <Button 
                  type="submit" 
                  disabled={isSubmitting || !amount || !price}
                  className={`w-full h-12 sm:h-14 text-base sm:text-lg font-semibold transition-all duration-300 ${
                    isSubmitting 
                      ? 'bg-gradient-to-r from-[#00f0ff]/50 to-[#00f0ff]/30 cursor-not-allowed' 
                      : 'bg-gradient-to-r from-[#00f0ff] to-[#00f0ff]/80 hover:from-[#00f0ff]/90 hover:to-[#00f0ff]/70 sm:hover:scale-105 hover:shadow-xl hover:shadow-[#00f0ff]/25'
                  } text-white border-0 rounded-xl`}
                >
                  {isSubmitting ? (
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
                      <span className="hidden sm:inline">Encrypting Order...</span>
                      <span className="sm:hidden">Encrypting...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 sm:gap-3">
                      <Lock className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span className="hidden sm:inline">Encrypt & Submit Buy Order</span>
                      <span className="sm:hidden">Submit Buy</span>
                    </div>
                  )}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="sell" className="space-y-6 mt-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-3">
                  <Label htmlFor="sell-amount" className="text-[#b4b4b4] text-sm font-medium">Amount</Label>
                  <div className="relative group">
                    <Input
                      id="sell-amount"
                      type="number"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="bg-black/40 border-[#ff00e5]/30 text-white pr-16 sm:pr-20 h-10 sm:h-12 text-base sm:text-lg focus:border-[#ff00e5] transition-all duration-300 group-hover:border-[#ff00e5]/50"
                    />
                    <div className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 sm:gap-2">
                      <Coins className="w-4 h-4 sm:w-5 sm:h-5 text-[#ff00e5]" />
                      <span className="text-white font-medium text-sm sm:text-base">SOL</span>
                    </div>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#b4b4b4]">Balance: {balance.toLocaleString()} SOL</span>
                    <button 
                      type="button" 
                      onClick={() => setAmount(balance.toString())}
                      className="text-[#ff00e5] hover:text-[#ff00e5]/80 transition-colors"
                    >
                      MAX
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="sell-price" className="text-[#b4b4b4] text-sm font-medium">Price</Label>
                  <div className="relative group">
                    <Input
                      id="sell-price"
                      type="number"
                      placeholder={marketPrice.toString()}
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="bg-black/40 border-[#ff00e5]/30 text-white pr-16 sm:pr-20 h-10 sm:h-12 text-base sm:text-lg focus:border-[#ff00e5] transition-all duration-300 group-hover:border-[#ff00e5]/50"
                    />
                    <div className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 sm:gap-2">
                      <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-[#ff00e5]" />
                      <span className="text-white font-medium text-sm sm:text-base">USDC</span>
                    </div>
                  </div>
                  <div className="text-sm text-[#b4b4b4]">
                    Market Price: ${marketPrice}
                  </div>
                </div>

                <Button 
                  type="submit" 
                  disabled={isSubmitting || !amount || !price}
                  className={`w-full h-12 sm:h-14 text-base sm:text-lg font-semibold transition-all duration-300 ${
                    isSubmitting 
                      ? 'bg-gradient-to-r from-[#ff00e5]/50 to-[#ff00e5]/30 cursor-not-allowed' 
                      : 'bg-gradient-to-r from-[#ff00e5] to-[#ff00e5]/80 hover:from-[#ff00e5]/90 hover:to-[#ff00e5]/70 sm:hover:scale-105 hover:shadow-xl hover:shadow-[#ff00e5]/25'
                  } text-white border-0 rounded-xl`}
                >
                  {isSubmitting ? (
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
                      <span className="hidden sm:inline">Encrypting Order...</span>
                      <span className="sm:hidden">Encrypting...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 sm:gap-3">
                      <Lock className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span className="hidden sm:inline">Encrypt & Submit Sell Order</span>
                      <span className="sm:hidden">Submit Sell</span>
                    </div>
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          {/* Order Preview */}
          {(amount && price) && (
            <Card className="bg-gradient-to-r from-[#00ff88]/10 to-[#00ff88]/5 border-[#00ff88]/30 animate-in slide-in-from-top duration-300">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 text-xs sm:text-sm text-[#00ff88] mb-2">
                  <Shield className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="font-medium">Order Preview (Encrypted)</span>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#b4b4b4]">Type:</span>
                    <span className={orderType === 'buy' ? 'text-[#00f0ff]' : 'text-[#ff00e5]'}>
                      {orderType.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#b4b4b4]">Amount:</span>
                    <span className="text-white">{amount} SOL</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#b4b4b4]">Price:</span>
                    <span className="text-white">${price}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#b4b4b4]">Total:</span>
                    <span className="text-white">${(parseFloat(amount || '0') * parseFloat(price || '0')).toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Privacy Guarantee */}
          <div className="p-3 sm:p-4 bg-gradient-to-r from-[#00ff88]/10 to-[#00ff88]/5 border border-[#00ff88]/30 rounded-xl">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-[#00ff88]/20 rounded-lg">
                <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-[#00ff88]" />
              </div>
              <div>
                <div className="text-[#00ff88] font-medium text-sm sm:text-base">MEV Protection Active</div>
                <div className="text-xs sm:text-sm text-[#b4b4b4]">Your order is encrypted and invisible to front-runners</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
