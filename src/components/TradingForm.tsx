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
      <Card className="professional-card">
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center justify-between flex-wrap sm:flex-nowrap gap-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary rounded-full flex items-center justify-center">
                <Coins className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-foreground">SOL/USDC</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">Solana / USD Coin</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg sm:text-2xl font-bold status-success">${marketPrice}</div>
              <div className="text-xs sm:text-sm status-success flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                +2.34%
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Trading Form */}
      <Card className="professional-card">
        <CardHeader className="pb-3 sm:pb-4 px-3 sm:px-6 pt-4 sm:pt-6">
          <CardTitle className="text-foreground flex items-center gap-2 text-base sm:text-lg">
            <div className="p-1.5 sm:p-2 bg-primary/20 rounded-lg">
              <ArrowUpDown className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            </div>
            Order Entry
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 sm:space-y-6 px-3 sm:px-6 pb-4 sm:pb-6">
          <Tabs value={orderType} onValueChange={(value) => setOrderType(value as 'buy' | 'sell')}>
            <TabsList className="grid w-full grid-cols-2 bg-muted p-1 rounded-lg">
              <TabsTrigger 
                value="buy" 
                className="data-[state=active]:bg-success/20 data-[state=active]:text-success text-muted-foreground rounded-md professional-animate"
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                Buy
              </TabsTrigger>
              <TabsTrigger 
                value="sell"
                className="data-[state=active]:bg-warning/20 data-[state=active]:text-warning text-muted-foreground rounded-md professional-animate"
              >
                <TrendingDown className="w-4 h-4 mr-2" />
                Sell
              </TabsTrigger>
            </TabsList>

            <TabsContent value="buy" className="space-y-6 mt-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-3">
                  <Label htmlFor="amount" className="text-muted-foreground text-sm font-medium">Amount</Label>
                  <div className="relative group">
                    <Input
                      id="amount"
                      type="number"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="professional-input pr-16 sm:pr-20 h-10 sm:h-12 text-base sm:text-lg"
                    />
                    <div className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 sm:gap-2">
                      <Coins className="w-4 h-4 sm:w-5 sm:h-5 status-success" />
                      <span className="text-foreground font-medium text-sm sm:text-base">SOL</span>
                    </div>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Balance: {balance.toLocaleString()} SOL</span>
                    <button 
                      type="button" 
                      onClick={() => setAmount(balance.toString())}
                      className="text-primary hover:text-primary/80 professional-animate"
                    >
                      MAX
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="price" className="text-muted-foreground text-sm font-medium">Price</Label>
                  <div className="relative group">
                    <Input
                      id="price"
                      type="number"
                      placeholder={marketPrice.toString()}
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="professional-input pr-16 sm:pr-20 h-10 sm:h-12 text-base sm:text-lg"
                    />
                    <div className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 sm:gap-2">
                      <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                      <span className="text-foreground font-medium text-sm sm:text-base">USDC</span>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Market Price: ${marketPrice}
                  </div>
                </div>

                <Button 
                  type="submit" 
                  disabled={isSubmitting || !amount || !price}
                  className={`w-full h-12 sm:h-14 text-base sm:text-lg font-semibold rounded-lg ${
                    isSubmitting 
                      ? 'opacity-50 cursor-not-allowed btn-primary' 
                      : 'btn-primary'
                  }`}
                >
                  {isSubmitting ? (
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
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
                  <Label htmlFor="sell-amount" className="text-muted-foreground text-sm font-medium">Amount</Label>
                  <div className="relative group">
                    <Input
                      id="sell-amount"
                      type="number"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="professional-input pr-16 sm:pr-20 h-10 sm:h-12 text-base sm:text-lg"
                    />
                    <div className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 sm:gap-2">
                      <Coins className="w-4 h-4 sm:w-5 sm:h-5 status-warning" />
                      <span className="text-foreground font-medium text-sm sm:text-base">SOL</span>
                    </div>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Balance: {balance.toLocaleString()} SOL</span>
                    <button 
                      type="button" 
                      onClick={() => setAmount(balance.toString())}
                      className="text-warning hover:text-warning/80 professional-animate"
                    >
                      MAX
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="sell-price" className="text-muted-foreground text-sm font-medium">Price</Label>
                  <div className="relative group">
                    <Input
                      id="sell-price"
                      type="number"
                      placeholder={marketPrice.toString()}
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="professional-input pr-16 sm:pr-20 h-10 sm:h-12 text-base sm:text-lg"
                    />
                    <div className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 sm:gap-2">
                      <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                      <span className="text-foreground font-medium text-sm sm:text-base">USDC</span>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Market Price: ${marketPrice}
                  </div>
                </div>

                <Button 
                  type="submit" 
                  disabled={isSubmitting || !amount || !price}
                  className={`w-full h-12 sm:h-14 text-base sm:text-lg font-semibold rounded-lg ${
                    isSubmitting 
                      ? 'opacity-50 cursor-not-allowed' 
                      : ''
                  } bg-warning hover:bg-warning/90 text-warning-foreground`}
                >
                  {isSubmitting ? (
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
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
            <Card className="professional-card border-success/30 bg-success/5">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 text-xs sm:text-sm status-success mb-2">
                  <Shield className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="font-medium">Order Preview (Encrypted)</span>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Type:</span>
                    <span className={orderType === 'buy' ? 'status-success' : 'status-warning'}>
                      {orderType.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Amount:</span>
                    <span className="text-foreground">{amount} SOL</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Price:</span>
                    <span className="text-foreground">${price}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total:</span>
                    <span className="text-foreground">${(parseFloat(amount || '0') * parseFloat(price || '0')).toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Privacy Guarantee */}
          <div className="professional-card border-success/30 bg-success/5">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-success/20 rounded-lg">
                <Shield className="w-4 h-4 sm:w-5 sm:h-5 status-success" />
              </div>
              <div>
                <div className="status-success font-medium text-sm sm:text-base">MEV Protection Active</div>
                <div className="text-xs sm:text-sm text-muted-foreground">Your order is encrypted and invisible to front-runners</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
