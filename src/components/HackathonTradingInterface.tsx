'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';

interface Order {
  orderHash: string;
  side: 'BUY' | 'SELL';
  amount: number;
  price: number;
  status: string;
  timestamp: number;
}

interface MarketData {
  volume24h: number;
  trades24h: number;
  avgPrice: number;
  totalOrders: number;
  activeOrders: number;
  privacy: {
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

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export function HackathonTradingInterface() {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  
  // State
  const [orderForm, setOrderForm] = useState({
    side: 'BUY' as 'BUY' | 'SELL',
    amount: '',
    price: '',
  });
  const [orders, setOrders] = useState<Order[]>([]);
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [matchingStats, setMatchingStats] = useState<MatchingStats | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState('');
  const [wsConnected, setWsConnected] = useState(false);

  // Fetch market data
  useEffect(() => {
    const fetchMarketData = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/market/data`);
        const data = await response.json();
        setMarketData(data);
      } catch (error) {
        console.error('Failed to fetch market data:', error);
      }
    };

    const fetchMatchingStats = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/matching/stats`);
        const data = await response.json();
        setMatchingStats(data);
      } catch (error) {
        console.error('Failed to fetch matching stats:', error);
      }
    };

    // Initial fetch
    fetchMarketData();
    fetchMatchingStats();

    // Poll every 5 seconds
    const interval = setInterval(() => {
      fetchMarketData();
      fetchMatchingStats();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Fetch user orders
  useEffect(() => {
    if (!publicKey) return;

    const fetchOrders = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/orders/wallet/${publicKey.toString()}`);
        const data = await response.json();
        setOrders(data.orders || []);
      } catch (error) {
        console.error('Failed to fetch orders:', error);
      }
    };

    fetchOrders();
    
    // Poll orders every 10 seconds
    const interval = setInterval(fetchOrders, 10000);
    return () => clearInterval(interval);
  }, [publicKey]);

  // Submit order
  const handleSubmitOrder = async () => {
    if (!publicKey) {
      setStatus('Please connect your wallet first');
      return;
    }

    if (!orderForm.amount || !orderForm.price) {
      setStatus('Please fill in all fields');
      return;
    }

    setIsSubmitting(true);
    setStatus('Submitting encrypted order...');

    try {
      const response = await fetch(`${API_BASE}/api/orders/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: publicKey.toString(),
          side: orderForm.side,
          amount: parseFloat(orderForm.amount),
          price: parseFloat(orderForm.price),
          signature: 'demo_signature', // In production, sign with wallet
        }),
      });

      const result = await response.json();

      if (result.success) {
        setStatus(`Order submitted! Hash: ${result.orderHash}`);
        setOrderForm({ side: 'BUY', amount: '', price: '' });
        
        // Refresh orders
        setTimeout(() => {
          const fetchOrders = async () => {
            const response = await fetch(`${API_BASE}/api/orders/wallet/${publicKey.toString()}`);
            const data = await response.json();
            setOrders(data.orders || []);
          };
          fetchOrders();
        }, 1000);
      } else {
        setStatus(`Order failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Order submission failed:', error);
      setStatus('Order submission failed');
    } finally {
      setIsSubmitting(false);
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
        setStatus(`Generated ${result.generated} demo orders`);
      } else {
        setStatus('Failed to generate demo orders');
      }
    } catch (error) {
      console.error('Demo generation failed:', error);
      setStatus('Demo generation failed');
    }
  };

  // Trigger matching round
  const triggerMatching = async () => {
    try {
      setStatus('Triggering matching round...');
      
      const response = await fetch(`${API_BASE}/api/matching/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();
      
      if (result.success) {
        setStatus(`Matching complete: ${result.matchedTrades} trades, clearing price $${result.clearingPrice}`);
      } else {
        setStatus('Matching failed');
      }
    } catch (error) {
      console.error('Matching failed:', error);
      setStatus('Matching failed');
    }
  };

  return (
    <div className="space-y-6">
      {/* Status Bar */}
      {status && (
        <Alert>
          <AlertDescription>{status}</AlertDescription>
        </Alert>
      )}

      {/* Market Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">24h Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {marketData ? `${marketData.volume24h.toFixed(0)} SOL` : '---'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Avg Price</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {marketData ? `$${marketData.avgPrice.toFixed(2)}` : '---'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Active Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {marketData ? marketData.activeOrders : '---'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Trades</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {marketData ? marketData.trades24h : '---'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Privacy Features */}
      {marketData?.privacy && (
        <Card>
          <CardHeader>
            <CardTitle>🔐 Privacy & Security</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Encryption</div>
                <Badge variant="outline">{marketData.privacy.encryption}</Badge>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Threshold Executors</div>
                <Badge variant="outline">{marketData.privacy.thresholdExecutors}</Badge>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Required Shares</div>
                <Badge variant="outline">{marketData.privacy.requiredShares}</Badge>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">VRF Enabled</div>
                <Badge variant={marketData.privacy.vrfEnabled ? "default" : "secondary"}>
                  {marketData.privacy.vrfEnabled ? "✅" : "❌"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="trade" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="trade">Trade</TabsTrigger>
          <TabsTrigger value="orders">My Orders</TabsTrigger>
          <TabsTrigger value="matching">Matching Engine</TabsTrigger>
          <TabsTrigger value="demo">Demo</TabsTrigger>
        </TabsList>

        {/* Trading Tab */}
        <TabsContent value="trade">
          <Card>
            <CardHeader>
              <CardTitle>Submit Encrypted Order</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Button
                  variant={orderForm.side === 'BUY' ? 'default' : 'outline'}
                  onClick={() => setOrderForm({...orderForm, side: 'BUY'})}
                  className="h-12"
                >
                  BUY
                </Button>
                <Button
                  variant={orderForm.side === 'SELL' ? 'default' : 'outline'}
                  onClick={() => setOrderForm({...orderForm, side: 'SELL'})}
                  className="h-12"
                >
                  SELL
                </Button>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Amount (SOL)</label>
                <Input
                  type="number"
                  placeholder="0.0"
                  value={orderForm.amount}
                  onChange={(e) => setOrderForm({...orderForm, amount: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Price (USD)</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={orderForm.price}
                  onChange={(e) => setOrderForm({...orderForm, price: e.target.value})}
                />
              </div>

              <Button 
                onClick={handleSubmitOrder}
                disabled={isSubmitting || !publicKey}
                className="w-full h-12"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Encrypted Order'}
              </Button>

              {!publicKey && (
                <p className="text-sm text-muted-foreground text-center">
                  Please connect your wallet to submit orders
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Orders Tab */}
        <TabsContent value="orders">
          <Card>
            <CardHeader>
              <CardTitle>My Orders ({orders.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <p className="text-muted-foreground">No orders found</p>
              ) : (
                <div className="space-y-2">
                  {orders.map((order) => (
                    <div key={order.orderHash} className="border rounded p-3">
                      <div className="flex justify-between items-center">
                        <div>
                          <Badge variant={order.side === 'BUY' ? 'default' : 'secondary'}>
                            {order.side}
                          </Badge>
                          <span className="ml-2">{order.amount} SOL @ ${order.price}</span>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline">{order.status}</Badge>
                          <div className="text-xs text-muted-foreground">
                            {new Date(order.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Matching Engine Tab */}
        <TabsContent value="matching">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Matching Engine Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {matchingStats && (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground">Round</div>
                        <div className="text-lg font-bold">#{matchingStats.roundNumber}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Buy Orders</div>
                        <div className="text-lg font-bold">{matchingStats.pendingBuyOrders}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Sell Orders</div>
                        <div className="text-lg font-bold">{matchingStats.pendingSellOrders}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Next Round</div>
                        <div className="text-lg font-bold">{matchingStats.nextRound}s</div>
                      </div>
                    </div>

                    <div>
                      <div className="text-sm font-medium mb-2">
                        Status: {matchingStats.isMatching ? 'Matching...' : 'Waiting'}
                      </div>
                      <Progress 
                        value={matchingStats.isMatching ? 75 : (30 - matchingStats.nextRound) / 30 * 100} 
                      />
                    </div>

                    <Button onClick={triggerMatching} className="w-full">
                      Trigger Matching Round
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Threshold Executors */}
            <Card>
              <CardHeader>
                <CardTitle>Threshold Executor Network</CardTitle>
              </CardHeader>
              <CardContent>
                {matchingStats?.executors && (
                  <div className="grid grid-cols-5 gap-2">
                    {matchingStats.executors.map((executor) => (
                      <div key={executor.id} className="text-center">
                        <div className={`w-8 h-8 rounded-full mx-auto mb-1 ${
                          executor.active ? 'bg-green-500' : 'bg-red-500'
                        }`}></div>
                        <div className="text-xs">Node {executor.id}</div>
                        <div className="text-xs text-muted-foreground">
                          {executor.performance.toFixed(1)}%
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Demo Tab */}
        <TabsContent value="demo">
          <Card>
            <CardHeader>
              <CardTitle>🎮 Hackathon Demo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Generate sample orders and simulate the dark pool matching process for demonstration.
              </p>

              <Button onClick={generateDemoOrders} className="w-full">
                Generate 10 Demo Orders
              </Button>

              <Button onClick={triggerMatching} variant="outline" className="w-full">
                Execute Matching Round
              </Button>

              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-medium mb-2">Demo Features:</h4>
                <ul className="text-sm space-y-1">
                  <li>• ElGamal Homomorphic Encryption</li>
                  <li>• 3-of-5 Threshold Decryption</li>
                  <li>• VRF-based Fair Ordering</li>
                  <li>• Zero-Knowledge Order Matching</li>
                  <li>• Real Solana Testnet Integration</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}