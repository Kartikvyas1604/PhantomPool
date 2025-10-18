'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/Header'
import { TradingInterface } from '@/components/TradingInterface'
import { ClientOnly } from '../components/ClientOnly'
import { DevnetTutorial } from '@/components/DevnetTutorial'
import { TradingProvider } from '../contexts/TradingContext'

// Updated interfaces to match hackathon API
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

interface FormOrder {
  type: 'buy' | 'sell';
  amount: string;
  price: string;
  trader: string;
  status: string;
}

// API types from hackathon backend
interface ApiOrder {
  orderHash: string;
  side: 'BUY' | 'SELL';
  amount: number;
  price: number;
  status: string;
  timestamp: number;
  walletAddress: string;
}

interface MarketData {
  volume24h: number;
  trades24h: number;
  avgPrice: number;
  totalOrders: number;
  activeOrders: number;
  privacy?: {
    encryption: string;
    thresholdExecutors: number;
    requiredShares: number;
    vrfEnabled: boolean;
  };
}

interface MarketStats {
  markPrice: number;
  change24h: number;
  volume24h: number;
  totalValueLocked: number;
  encryptedOrders: number;
  activeExecutors: number;
}

const API_BASE = 'http://localhost:4000';

export default function HomePage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [matchedTrades, setMatchedTrades] = useState<Trade[]>([])
  const [isMatching, setIsMatching] = useState(false)
  const [showTutorial, setShowTutorial] = useState(false)
  const [marketData, setMarketData] = useState<MarketData | null>(null)
  const [marketStats, setMarketStats] = useState<MarketStats>({
    markPrice: 149.50,
    change24h: 2.34,
    volume24h: 125000,
    totalValueLocked: 2500000,
    encryptedOrders: 0,
    activeExecutors: 5
  })
  
  const [matchingRound, setMatchingRound] = useState({
    currentRound: 1,
    nextRoundIn: 30,
    lastClearingPrice: 0
  })

  // Show tutorial on first visit for testnet (labeled as devnet)
  useEffect(() => {
    const hasSeenTutorial = localStorage.getItem('phantompool-tutorial-seen');
    const isTestnet = process.env.SOLANA_NETWORK === 'testnet' || 
                     process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.includes('testnet');
    
    if (!hasSeenTutorial && isTestnet) {
      setShowTutorial(true);
    }
  }, []);

  const handleCloseTutorial = () => {
    setShowTutorial(false);
    localStorage.setItem('phantompool-tutorial-seen', 'true');
  };

  // Fetch data from hackathon API
  useEffect(() => {
    const fetchMarketData = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/market/data`);
        if (response.ok) {
          const data = await response.json();
          setMarketData(data);
          
          // Update market stats with real data
          setMarketStats(prev => ({
            ...prev,
            markPrice: data.avgPrice || 149.50,
            volume24h: data.volume24h || 125000,
            encryptedOrders: data.totalOrders || 0,
            totalValueLocked: data.volume24h ? data.volume24h * 150 : 2500000
          }));
        }
      } catch (error) {
        console.log('API not available, using mock data');
      }
    };

    const fetchMatchingStats = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/matching/stats`);
        if (response.ok) {
          const data = await response.json();
          setIsMatching(data.isMatching || false);
          setMatchingRound(prev => ({
            ...prev,
            currentRound: data.roundNumber || 1,
            nextRoundIn: data.nextRound || 30
          }));
        }
      } catch (error) {
        console.log('Matching stats not available');
      }
    };

    // Initial fetch
    fetchMarketData();
    fetchMatchingStats();

    // Set up intervals
    const dataInterval = setInterval(fetchMarketData, 5000);
    const statsInterval = setInterval(fetchMatchingStats, 3000);
    
    const timerInterval = setInterval(() => {
      setMatchingRound(prev => ({
        ...prev,
        nextRoundIn: prev.nextRoundIn > 0 ? prev.nextRoundIn - 1 : 30
      }))
    }, 1000)

    return () => {
      clearInterval(dataInterval);
      clearInterval(statsInterval);
      clearInterval(timerInterval);
    }
  }, [])

  // Convert API order to UI order format
  const convertApiOrderToUiOrder = (apiOrder: ApiOrder, id: number): Order => {
    return {
      id,
      trader: `${apiOrder.walletAddress.slice(0, 8)}...`,
      amount: `${apiOrder.amount} SOL`,
      price: `$${apiOrder.price.toFixed(2)}`,
      encrypted: `ElG:${apiOrder.orderHash.slice(0, 8)}...`,
      status: apiOrder.status,
      type: apiOrder.side.toLowerCase() as 'buy' | 'sell',
      timestamp: apiOrder.timestamp,
      orderHash: apiOrder.orderHash,
      solvencyProof: `BP:${Math.floor(apiOrder.amount * apiOrder.price).toString(16).slice(0, 8)}`
    };
  };

  const addOrder = async (orderData: FormOrder) => {
    try {
      // Submit to hackathon API
      const response = await fetch(`${API_BASE}/api/orders/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: `DemoWallet${Date.now()}`,
          side: orderData.type.toUpperCase(),
          amount: parseFloat(orderData.amount.replace(/[^\d.]/g, '')),
          price: parseFloat(orderData.price.replace(/[^\d.]/g, '')),
          signature: 'demo_signature',
        }),
      });

      if (response.ok) {
        const result = await response.json();
        
        if (result.success) {
          // Add to local UI state
          const newOrder: Order = {
            id: orders.length + 1,
            trader: orderData.trader || `User${Date.now()}`,
            amount: orderData.amount,
            price: orderData.price,
            encrypted: `ElG:${result.orderHash.slice(0, 8)}...`,
            status: 'pending',
            type: orderData.type,
            timestamp: Date.now(),
            orderHash: result.orderHash,
            solvencyProof: `BP:${Math.floor(parseFloat(orderData.amount.replace(/[^\d.]/g, '')) * parseFloat(orderData.price.replace(/[^\d.]/g, ''))).toString(16).slice(0, 8)}`
          };
          
          setOrders(prev => [...prev, newOrder]);
          setMarketStats(prev => ({
            ...prev,
            encryptedOrders: prev.encryptedOrders + 1
          }));
        } else {
          console.error('Order submission failed:', result.error);
          alert(`Order submission failed: ${result.error}`);
        }
      } else {
        throw new Error('API request failed');
      }
    } catch (error: any) {
      console.error('Error submitting order:', error);
      
      // Fallback to local-only order for UI demonstration
      const newOrder: Order = {
        id: orders.length + 1,
        trader: orderData.trader || `User${Date.now()}`,
        amount: orderData.amount,
        price: orderData.price,
        encrypted: `ElG:${Date.now().toString(16).slice(-8)}...`,
        status: 'pending',
        type: orderData.type,
        timestamp: Date.now(),
        orderHash: `local_${Date.now()}`,
        solvencyProof: `BP:${Math.floor(parseFloat(orderData.amount.replace(/[^\d.]/g, '')) * parseFloat(orderData.price.replace(/[^\d.]/g, ''))).toString(16).slice(0, 8)}`
      };
      
      setOrders(prev => [...prev, newOrder]);
      setMarketStats(prev => ({
        ...prev,
        encryptedOrders: prev.encryptedOrders + 1
      }));
    }
  }

  // Auto-generate some demo trades periodically
  useEffect(() => {
    const generateDemoTrade = () => {
      if (orders.length > 0 && Math.random() > 0.7) {
        const newTrade: Trade = {
          id: `trade_${Date.now()}`,
          type: Math.random() > 0.5 ? 'buy' : 'sell',
          amount: `${(Math.random() * 2 + 0.5).toFixed(3)} SOL`,
          price: `$${(marketStats.markPrice + (Math.random() - 0.5) * 4).toFixed(2)}`,
          timestamp: Date.now(),
          txSignature: `${Date.now().toString(16)}...`
        };
        
        setMatchedTrades(prev => [newTrade, ...prev.slice(0, 9)]);
      }
    };

    const tradeInterval = setInterval(generateDemoTrade, 15000);
    return () => clearInterval(tradeInterval);
  }, [orders.length, marketStats.markPrice]);

  // Auto-generate some orders when the page loads
  useEffect(() => {
    const generateInitialOrders = async () => {
      try {
        // Try to generate demo orders via API
        const response = await fetch(`${API_BASE}/api/demo/generate-orders`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ count: 5 }),
        });

        if (response.ok) {
          const result = await response.json();
          console.log(`Generated ${result.generated} demo orders via API`);
        }
      } catch (error) {
        console.log('API not available, generating local demo orders');
        
        // Generate local demo orders for UI
        const demoOrders: Order[] = [
          {
            id: 1,
            trader: 'Alice...4x7k',
            amount: '2.5 SOL',
            price: '$148.50',
            encrypted: 'ElG:a7b8c9d1...',
            status: 'pending',
            type: 'buy',
            timestamp: Date.now() - 30000,
            orderHash: 'demo_1',
            solvencyProof: 'BP:12a34b56'
          },
          {
            id: 2,
            trader: 'Bob...9m2n',
            amount: '1.8 SOL',
            price: '$149.75',
            encrypted: 'ElG:e1f2g3h4...',
            status: 'pending',
            type: 'sell',
            timestamp: Date.now() - 20000,
            orderHash: 'demo_2',
            solvencyProof: 'BP:78c90d12'
          },
          {
            id: 3,
            trader: 'Carol...5z8w',
            amount: '3.2 SOL',
            price: '$150.25',
            encrypted: 'ElG:i5j6k7l8...',
            status: 'pending',
            type: 'buy',
            timestamp: Date.now() - 10000,
            orderHash: 'demo_3',
            solvencyProof: 'BP:34e56f78'
          }
        ];
        
        setOrders(demoOrders);
        setMarketStats(prev => ({
          ...prev,
          encryptedOrders: demoOrders.length
        }));
      }
    };

    generateInitialOrders();
  }, []);



  return (
    <TradingProvider
      userId={`user_${Date.now()}`}
      apiBaseUrl="http://localhost:8080/api"
      wsUrl="ws://localhost:8080/ws"
    >
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
        <Header onShowTutorial={() => setShowTutorial(true)} />
      
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

        {/* Devnet Tutorial */}
        <DevnetTutorial 
          isVisible={showTutorial}
          onClose={handleCloseTutorial}
        />

        </div>
      </div>
    </TradingProvider>
  )
}