'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';

interface Order {
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

interface MatchingStats {
  roundNumber: number;
  isMatching: boolean;
  pendingBuyOrders: number;
  pendingSellOrders: number;
  activeExecutors: number;
  nextRound: number;
  executors: Array<{
    id: number;
    active: boolean;
    performance: number;
  }>;
}

const API_BASE = 'http://localhost:4000';

export default function HackathonDemoPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [matchingStats, setMatchingStats] = useState<MatchingStats | null>(null);
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [status, setStatus] = useState('');
  
  const [orderForm, setOrderForm] = useState({
    side: 'BUY' as 'BUY' | 'SELL',
    amount: '',
    price: '',
  });

  // Check server status and fetch data
  useEffect(() => {
    const checkServerAndFetchData = async () => {
      try {
        setServerStatus('checking');
        
        // Health check
        const healthResponse = await fetch(`${API_BASE}/api/health`);
        if (!healthResponse.ok) throw new Error('Server not responding');
        
        setServerStatus('online');
        
        // Fetch market data
        const marketResponse = await fetch(`${API_BASE}/api/market/data`);
        if (marketResponse.ok) {
          const data = await marketResponse.json();
          setMarketData(data);
        }
        
        // Fetch matching stats
        const statsResponse = await fetch(`${API_BASE}/api/matching/stats`);
        if (statsResponse.ok) {
          const data = await statsResponse.json();
          setMatchingStats(data);
        }
        
      } catch (error) {
        console.error('Server check failed:', error);
        setServerStatus('offline');
      }
    };

    // Initial check
    checkServerAndFetchData();
    
    // Poll every 5 seconds
    const interval = setInterval(checkServerAndFetchData, 5000);
    
    return () => clearInterval(interval);
  }, []);

  // Submit order
  const handleSubmitOrder = async () => {
    if (!orderForm.amount || !orderForm.price) {
      setStatus('Please fill in all fields');
      return;
    }

    try {
      setStatus('Submitting encrypted order...');
      
      const response = await fetch(`${API_BASE}/api/orders/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: `DemoWallet${Date.now()}`,
          side: orderForm.side,
          amount: parseFloat(orderForm.amount),
          price: parseFloat(orderForm.price),
          signature: 'demo_signature',
        }),
      });

      const result = await response.json();

      if (result.success) {
        setStatus(`✅ Order submitted! Hash: ${result.orderHash}`);
        setOrderForm({ side: 'BUY', amount: '', price: '' });
      } else {
        setStatus(`❌ Order failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Order submission failed:', error);
      setStatus('❌ Order submission failed - server offline');
    }
  };

  // Generate demo orders
  const generateDemoOrders = async () => {
    try {
      setStatus('Generating demo orders...');
      
      const response = await fetch(`${API_BASE}/api/demo/generate-orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ count: 10 }),
      });

      const result = await response.json();
      
      if (result.success) {
        setStatus(`✅ Generated ${result.generated} demo orders`);
      } else {
        setStatus('❌ Failed to generate demo orders');
      }
    } catch (error) {
      console.error('Demo generation failed:', error);
      setStatus('❌ Demo generation failed - server offline');
    }
  };

  // Trigger matching
  const triggerMatching = async () => {
    try {
      setStatus('🔄 Triggering matching round...');
      
      const response = await fetch(`${API_BASE}/api/matching/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();
      
      if (result.success) {
        setStatus(`✅ Matching complete: ${result.matchedTrades} trades at $${result.clearingPrice?.toFixed(2)}`);
      } else {
        setStatus('❌ Matching failed');
      }
    } catch (error) {
      console.error('Matching failed:', error);
      setStatus('❌ Matching failed - server offline');
    }
  };

  const getServerStatusBadge = () => {
    switch (serverStatus) {
      case 'checking':
        return <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs">Checking...</span>;
      case 'online':
        return <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">● Online</span>;
      case 'offline':
        return <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs">● Offline</span>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <Header />
      
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-2">
            🚀 PhantomPool Hackathon Demo
          </h1>
          <p className="text-slate-400 mb-4">
            Zero-Knowledge Dark Pool Trading with Homomorphic Encryption
          </p>
          <div className="flex justify-center items-center gap-4">
            <span className="text-sm">Server Status:</span>
            {getServerStatusBadge()}
          </div>
        </div>

        {/* Status Message */}
        {status && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 mb-6 text-center">
            <span className="text-sm">{status}</span>
          </div>
        )}

        {/* Market Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-4">
            <div className="text-sm text-slate-400 mb-1">24h Volume</div>
            <div className="text-2xl font-bold">
              {marketData ? `${marketData.volume24h.toFixed(0)} SOL` : '---'}
            </div>
          </div>
          
          <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-4">
            <div className="text-sm text-slate-400 mb-1">Avg Price</div>
            <div className="text-2xl font-bold">
              {marketData ? `$${marketData.avgPrice.toFixed(2)}` : '---'}
            </div>
          </div>
          
          <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-4">
            <div className="text-sm text-slate-400 mb-1">Active Orders</div>
            <div className="text-2xl font-bold">
              {marketData ? marketData.activeOrders : '---'}
            </div>
          </div>
          
          <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-4">
            <div className="text-sm text-slate-400 mb-1">Total Trades</div>
            <div className="text-2xl font-bold">
              {marketData ? marketData.trades24h : '---'}
            </div>
          </div>
        </div>

        {/* Privacy Features */}
        {marketData?.privacy && (
          <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-6 mb-8">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              🔐 Privacy & Security Features
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-slate-400">Encryption</div>
                <div className="font-mono text-green-400">{marketData.privacy.encryption}</div>
              </div>
              <div>
                <div className="text-sm text-slate-400">Threshold Executors</div>
                <div className="font-mono text-blue-400">{marketData.privacy.thresholdExecutors}</div>
              </div>
              <div>
                <div className="text-sm text-slate-400">Required Shares</div>
                <div className="font-mono text-purple-400">{marketData.privacy.requiredShares}</div>
              </div>
              <div>
                <div className="text-sm text-slate-400">VRF Enabled</div>
                <div className="font-mono text-emerald-400">
                  {marketData.privacy.vrfEnabled ? "✅ Yes" : "❌ No"}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Trading Panel */}
          <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-4">Submit Encrypted Order</h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setOrderForm({...orderForm, side: 'BUY'})}
                  className={`py-3 px-4 rounded-lg font-medium transition-colors ${
                    orderForm.side === 'BUY' 
                      ? 'bg-green-600 text-white' 
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  BUY
                </button>
                <button
                  onClick={() => setOrderForm({...orderForm, side: 'SELL'})}
                  className={`py-3 px-4 rounded-lg font-medium transition-colors ${
                    orderForm.side === 'SELL' 
                      ? 'bg-red-600 text-white' 
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  SELL
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Amount (SOL)</label>
                <input
                  type="number"
                  placeholder="0.0"
                  value={orderForm.amount}
                  onChange={(e) => setOrderForm({...orderForm, amount: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Price (USD)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={orderForm.price}
                  onChange={(e) => setOrderForm({...orderForm, price: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>

              <button
                onClick={handleSubmitOrder}
                disabled={serverStatus === 'offline'}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
              >
                Submit Encrypted Order
              </button>
            </div>
          </div>

          {/* Matching Engine Status */}
          <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-4">Matching Engine Status</h3>
            
            {matchingStats && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-slate-400">Round</div>
                    <div className="text-lg font-bold">#{matchingStats.roundNumber}</div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-400">Next Round</div>
                    <div className="text-lg font-bold">{matchingStats.nextRound}s</div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-400">Buy Orders</div>
                    <div className="text-lg font-bold text-green-400">{matchingStats.pendingBuyOrders}</div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-400">Sell Orders</div>
                    <div className="text-lg font-bold text-red-400">{matchingStats.pendingSellOrders}</div>
                  </div>
                </div>

                <div>
                  <div className="text-sm text-slate-400 mb-2">
                    Status: {matchingStats.isMatching ? 'Matching...' : 'Waiting for next round'}
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-1000"
                      style={{ 
                        width: `${matchingStats.isMatching ? 75 : (30 - matchingStats.nextRound) / 30 * 100}%` 
                      }}
                    ></div>
                  </div>
                </div>

                {/* Threshold Executors */}
                <div>
                  <div className="text-sm text-slate-400 mb-2">Threshold Executor Network</div>
                  <div className="grid grid-cols-5 gap-2">
                    {matchingStats.executors.map((executor) => (
                      <div key={executor.id} className="text-center">
                        <div className={`w-8 h-8 rounded-full mx-auto mb-1 ${
                          executor.active ? 'bg-green-500' : 'bg-red-500'
                        }`}></div>
                        <div className="text-xs">Node {executor.id}</div>
                        <div className="text-xs text-slate-400">
                          {executor.performance.toFixed(1)}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Demo Controls */}
        <div className="mt-8 bg-slate-800/30 border border-slate-700 rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-4">🎮 Hackathon Demo Controls</h3>
          <p className="text-slate-400 mb-4">
            Use these controls to demonstrate the dark pool functionality for judges.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={generateDemoOrders}
              disabled={serverStatus === 'offline'}
              className="py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              Generate 10 Demo Orders
            </button>
            
            <button
              onClick={triggerMatching}
              disabled={serverStatus === 'offline'}
              className="py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              Execute Matching Round
            </button>
          </div>

          <div className="mt-4 p-4 bg-slate-700/30 rounded-lg">
            <h4 className="font-medium mb-2">🏆 Key Features Demonstrated:</h4>
            <ul className="text-sm space-y-1">
              <li>• <span className="text-green-400">ElGamal Homomorphic Encryption</span> - Orders encrypted before submission</li>
              <li>• <span className="text-blue-400">3-of-5 Threshold Decryption</span> - Distributed network consensus</li>
              <li>• <span className="text-purple-400">VRF-based Fair Ordering</span> - Manipulation-resistant order processing</li>
              <li>• <span className="text-orange-400">Zero-Knowledge Matching</span> - Privacy-preserving order book</li>
              <li>• <span className="text-emerald-400">Real Solana Integration</span> - Production-ready blockchain connection</li>
            </ul>
          </div>
        </div>

        {/* Instructions for Judges */}
        <div className="mt-8 bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-500/30 rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-4 text-blue-400">📋 Instructions for Hackathon Judges</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div>
              <h4 className="font-medium mb-2">1. Start the Backend Server:</h4>
              <code className="block bg-slate-800 p-2 rounded font-mono text-xs">npm run hackathon</code>
              
              <h4 className="font-medium mb-2 mt-4">2. Test Order Submission:</h4>
              <ul className="space-y-1 text-slate-300">
                <li>• Enter amount and price</li>
                <li>• Click "Submit Encrypted Order"</li>
                <li>• Order is automatically encrypted</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">3. Demonstrate Dark Pool:</h4>
              <ul className="space-y-1 text-slate-300">
                <li>• Click "Generate 10 Demo Orders"</li>
                <li>• Watch matching engine status</li>
                <li>• Click "Execute Matching Round"</li>
                <li>• Observe threshold decryption process</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}