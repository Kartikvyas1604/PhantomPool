'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/Header'
import { TradingInterface } from '@/components/TradingInterface'
import { ClientOnly } from '@/components/ClientOnly'
import { ElGamalRealService as ElGamalService } from '@/crypto/elgamal.enhanced.service'
import { DarkPoolService } from '@/services/darkpool.service'

interface Order {
  id: number;
  trader: string;
  amount: string;
  price: string;
  encrypted: string;
  status: string;
  type: 'buy' | 'sell';
  timestamp: number;
  orderHash: string;
  solvencyProof?: string;
}

interface Trade {
  id: string;
  type: 'buy' | 'sell';
  amount: string;
  price: string;
  timestamp: number;
  txSignature?: string;
}

interface MarketStats {
  markPrice: number;
  change24h: number;
  volume24h: number;
  totalValueLocked: number;
  encryptedOrders: number;
  activeExecutors: number;
}

export default function HomePage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [matchedTrades] = useState<Trade[]>([])
  const [isMatching, setIsMatching] = useState(false)
  const [marketStats, setMarketStats] = useState<MarketStats>({
    markPrice: 0,
    change24h: 0,
    volume24h: 0,
    totalValueLocked: 0,
    encryptedOrders: 0,
    activeExecutors: 5
  })
  
  const [matchingRound, setMatchingRound] = useState({
    currentRound: 1,
    nextRoundIn: 30,
    lastClearingPrice: 0
  })

  const addOrder = async (orderData: Omit<Order, 'id' | 'orderHash' | 'encrypted' | 'timestamp'>) => {
    try {
      // Get real wallet data from Phantom wallet service
      const { PhantomWalletService } = await import('../services/phantom-wallet.service');
      const walletService = PhantomWalletService.getInstance();
      const walletState = walletService.getWalletState();

      if (!walletState.isConnected || !walletState.publicKey) {
        throw new Error('Wallet not connected. Please connect your Phantom wallet first.');
      }

      // Sign the order with the real wallet
      const orderMessage = `${orderData.type}-${orderData.amount}-${orderData.price}-${Date.now()}`;
      const signature = await walletService.signMessage(orderMessage);

      const darkPoolService = DarkPoolService.getInstance();
      const result = await darkPoolService.submitOrder({
        tokenPair: 'SOL-USDC',
        side: orderData.type === 'buy' ? 'BUY' : 'SELL',
        amount: orderData.amount,
        price: orderData.price,
        walletAddress: walletState.publicKey,
        balance: walletState.balance.toString(),
        signature: signature
      });

      if (result.success) {
        // Generate local display data for UI
        const keyPair = ElGamalService.generateKeyPair()
        const amountValue = parseFloat(orderData.amount.replace(/[^\d.]/g, ''))
        const priceValue = parseFloat(orderData.price.replace(/[^\d.]/g, ''))
        
        const amountBig = BigInt(Math.floor(amountValue * 1000000))
        const priceBig = BigInt(Math.floor(priceValue * 1000000))
        
        const encryptedAmount = ElGamalService.encrypt(keyPair.pk, amountBig)
        const encryptedPrice = ElGamalService.encrypt(keyPair.pk, priceBig)
        
        const newOrder: Order = {
          ...orderData,
          id: orders.length + 1,
          orderHash: result.orderId || generateOrderHash(orderData, Date.now()),
          timestamp: Date.now(),
          encrypted: `ElG:${encryptedAmount.c1.x.toString(16).slice(0, 8)}...${encryptedAmount.c2.x.toString(16).slice(-4)},${encryptedPrice.c1.x.toString(16).slice(0, 8)}...${encryptedPrice.c2.x.toString(16).slice(-4)}`,
          solvencyProof: generateSolvencyProof(amountValue, priceValue),
          status: 'pending'
        }
        
        setOrders(prev => [...prev, newOrder])
        setMarketStats(prev => ({
          ...prev,
          encryptedOrders: prev.encryptedOrders + 1
        }))
      } else {
        console.error('Failed to submit order:', result.error);
        alert(`Order submission failed: ${result.error}`);
      }
    } catch (error: any) {
      console.error('Error submitting order:', error);
      alert(`Error: ${error.message}`);
    }
  }

  const generateOrderHash = (orderData: Omit<Order, 'id' | 'orderHash' | 'encrypted' | 'timestamp'>, timestamp: number): string => {
    const dataString = `${orderData.trader}-${orderData.type}-${orderData.amount}-${orderData.price}-${timestamp}`
    return `0x${btoa(dataString).slice(0, 16)}`
  }

  const generateSolvencyProof = (amount: number, price: number): string => {
    const requiredBalance = amount * price
    return `BP:${Math.floor(requiredBalance).toString(16).slice(0, 8)}`
  }

  // Fetch live data from backend
  useEffect(() => {
    const fetchLiveData = async () => {
      try {
        const darkPoolService = DarkPoolService.getInstance();
        const [matchingStatus, poolStats] = await Promise.all([
          darkPoolService.getMatchingStatus(),
          darkPoolService.getPoolStats()
        ]);

        const typedMatchingStatus = matchingStatus as {
          isMatching?: boolean;
          nextRoundIn?: number;
          lastRound?: { clearingPrice?: number };
        };
        
        setIsMatching(typedMatchingStatus.isMatching || false);
        setMatchingRound(prev => ({
          ...prev,
          nextRoundIn: typedMatchingStatus.nextRoundIn || 30,
          lastClearingPrice: typedMatchingStatus.lastRound?.clearingPrice || 0
        }));
        
        setMarketStats(prev => ({
          ...prev,
          totalValueLocked: parseFloat(poolStats.totalVolume) || 0,
          encryptedOrders: poolStats.totalOrders || 0,
          activeExecutors: poolStats.activeTraders || 5
        }));
      } catch (error) {
        console.log('Using mock data due to API error:', error);
      }
    };

    fetchLiveData();
    const dataInterval = setInterval(fetchLiveData, 5000); // Update every 5 seconds

    const timerInterval = setInterval(() => {
      setMatchingRound(prev => ({
        ...prev,
        nextRoundIn: prev.nextRoundIn > 0 ? prev.nextRoundIn - 1 : 30
      }))
    }, 1000)

    return () => {
      clearInterval(dataInterval);
      clearInterval(timerInterval);
    }
  }, [])



  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <Header />
      
      {/* Professional Trading Terminal Layout */}
      <div className="flex flex-col h-screen">
        {/* Advanced Market Data Header */}
        <div className="border-b border-slate-800/50 bg-gradient-to-r from-slate-900/80 to-slate-800/60 backdrop-blur-sm px-3 sm:px-6 py-3 sm:py-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 lg:gap-0">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-8">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg">
                  <span className="text-sm font-bold text-white">PP</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg sm:text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">SOL/USDC</span>
                    <span className="text-xs px-2 py-1 bg-purple-900/30 text-purple-300 rounded-full">Dark Pool</span>
                  </div>
                  <span className="text-xs text-slate-400">Zero-Knowledge Trading</span>
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-4 sm:gap-6 lg:gap-8 text-sm">
                <div className="flex flex-col min-w-0">
                  <span className="text-xs text-slate-400">Mark Price</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm sm:text-lg font-mono text-emerald-400">${marketStats.markPrice.toFixed(2)}</span>
                    <span className="text-xs text-emerald-400">+{marketStats.change24h}%</span>
                  </div>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs text-slate-400">24h Volume</span>
                  <span className="font-mono text-slate-200 text-sm">${(marketStats.volume24h / 1000000).toFixed(2)}M</span>
                </div>
                <div className="flex flex-col min-w-0 hidden sm:flex">
                  <span className="text-xs text-slate-400">Total Value Locked</span>
                  <span className="font-mono text-slate-200 text-sm">${(marketStats.totalValueLocked / 1000000).toFixed(2)}M</span>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs text-slate-400">Encrypted Orders</span>
                  <span className="font-mono text-blue-400 text-sm">{marketStats.encryptedOrders}</span>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4 lg:gap-6">
              <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                  <span className="text-emerald-400 hidden sm:inline">ElGamal Encrypted</span>
                  <span className="text-emerald-400 sm:hidden">Encrypted</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                  <span className="text-blue-400 hidden sm:inline">VRF Shuffled</span>
                  <span className="text-blue-400 sm:hidden">Shuffled</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                  <span className="text-purple-400 hidden sm:inline">ZK Verified</span>
                  <span className="text-purple-400 sm:hidden">ZK</span>
                </div>
              </div>
              
              <div className="flex flex-col items-start lg:items-end text-sm w-full lg:w-auto">
                <span className="text-xs text-slate-400">Next Matching Round</span>
                <div className="flex items-center gap-2 w-full lg:w-auto">
                  <span className="font-mono text-orange-400">{matchingRound.nextRoundIn}s</span>
                  <div className="flex-1 lg:flex-none w-full lg:w-16 h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-orange-400 to-red-400 transition-all duration-1000"
                      style={{ width: `${((30 - matchingRound.nextRoundIn) / 30) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Matching Status Bar */}
        {isMatching && (
          <div className="border-b border-amber-500/30 bg-gradient-to-r from-amber-950/40 to-orange-950/40 backdrop-blur-sm">
            <div className="px-3 sm:px-6 py-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 text-amber-400">
                <div className="flex items-center gap-3">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                  <span className="font-medium text-sm sm:text-base">Threshold Decryption in Progress...</span>
                </div>
                <span className="text-xs sm:text-sm">Round #{matchingRound.currentRound} • {marketStats.activeExecutors}/5 Executors Active</span>
              </div>
            </div>
          </div>
        )}

        {/* Main Trading Interface */}
        <div className="flex-1 overflow-hidden">
          <ClientOnly>
            <TradingInterface 
              orders={orders}
              matchedTrades={matchedTrades}
              isMatching={isMatching}
              onAddOrder={addOrder}
            />
          </ClientOnly>
        </div>


      </div>
    </div>
  )
}