'use client';

import { useState } from 'react';
import { Header } from '@/components/Header'
import { TradingInterface } from '@/components/TradingInterface'
import { CryptoProofsDashboard } from '@/components/CryptoProofsDashboard'
import { SplineBackground } from '@/components/SplineBackground'
import { ClientOnly } from '@/components/ClientOnly'
import { ElGamalService } from '@/crypto/elgamal.service'
import { VRFService } from '@/crypto/vrf.service'

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

export default function HomePage() {
  const [orders, setOrders] = useState<Order[]>([
    { id: 1, trader: 'Whale #1', amount: '250 SOL', price: '149.50', encrypted: 'ElG:8a9f...3d2e', status: 'pending', type: 'buy', timestamp: 1696521600000 },
    { id: 2, trader: 'Whale #2', amount: '180 SOL', price: '150.20', encrypted: 'ElG:7c4b...9a1f', status: 'pending', type: 'sell', timestamp: 1696521660000 },
    { id: 3, trader: 'Whale #3', amount: '320 SOL', price: '149.80', encrypted: 'ElG:2e8d...5c7a', status: 'pending', type: 'buy', timestamp: 1696521720000 },
  ])

  const [matchedTrades, setMatchedTrades] = useState<any[]>([])
  const [isMatching, setIsMatching] = useState(false)
  const [demoStatus, setDemoStatus] = useState<string | null>(null)

  const addOrder = (order: Omit<Order, 'id'>) => {
    const keyPair = ElGamalService.generateKeyPair()
    const amountBig = BigInt(Math.floor(parseFloat(order.amount.replace(' SOL', '')) * 100))
    const priceBig = BigInt(Math.floor(parseFloat(order.price.replace('$', '')) * 100))
    
    const encryptedAmount = ElGamalService.encrypt(keyPair.pk, amountBig)
    const encryptedPrice = ElGamalService.encrypt(keyPair.pk, priceBig)
    
    const newOrder = { 
      ...order, 
      id: orders.length + 1, 
      status: 'pending',
      timestamp: Date.now(),
      encrypted: `ElG:${encryptedAmount.c1.x.toString(16).slice(0, 8)}...${encryptedAmount.c2.x.toString(16).slice(-4)}`
    }
    setOrders([...orders, newOrder])
    setDemoStatus('🔒 Order encrypted with ElGamal homomorphic encryption')
    setTimeout(() => setDemoStatus(null), 4000)
  }

  const simulateTraders = () => {
    const baseTime = Date.now();
    const newOrders: Order[] = [
      { id: orders.length + 1, trader: 'Whale #4', amount: '500 SOL', price: '150.00', encrypted: 'ElG:4f8a...7d2c', status: 'pending', type: 'buy' as const, timestamp: baseTime + (orders.length + 1) * 60000 },
      { id: orders.length + 2, trader: 'Whale #5', amount: '350 SOL', price: '149.90', encrypted: 'ElG:9c2b...5a1e', status: 'pending', type: 'sell' as const, timestamp: baseTime + (orders.length + 2) * 60000 },
      { id: orders.length + 3, trader: 'Whale #6', amount: '275 SOL', price: '150.10', encrypted: 'ElG:1d7e...8f3b', status: 'pending', type: 'buy' as const, timestamp: baseTime + (orders.length + 3) * 60000 },
      { id: orders.length + 4, trader: 'Whale #7', amount: '425 SOL', price: '149.95', encrypted: 'ElG:6a3f...2c9d', status: 'pending', type: 'sell' as const, timestamp: baseTime + (orders.length + 4) * 60000 },
      { id: orders.length + 5, trader: 'Whale #8', amount: '190 SOL', price: '150.05', encrypted: 'ElG:3e9c...4b7a', status: 'pending', type: 'buy' as const, timestamp: baseTime + (orders.length + 5) * 60000 },
    ]
    
    const shuffleResult = VRFService.shuffleOrders(newOrders.map(o => o.id))
    const shuffledOrders = shuffleResult.shuffledIndices.map(id => 
      newOrders.find(o => o.id === id)!
    ).filter(Boolean)
    
    setOrders([...orders, ...shuffledOrders])
    setDemoStatus('🎲 VRF shuffle completed - orders randomized for fair matching')
    setTimeout(() => setDemoStatus(null), 4000)
  }

  // Removed unused matchOrders function

  // Removed unused resetDemo function

  return (
  <div className="min-h-screen bg-background relative w-full min-w-0">      
      {/* Content */}
  <main className="w-full max-w-7xl mx-auto px-1 xs:px-2 sm:px-4 md:px-8 min-w-0">
    <div className="relative z-10">
      <Header />
      {/* Demo Status Bar */}
      {demoStatus && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2">
          <div className="professional-card border-success/30 bg-success/5">
            <div className="flex items-center justify-center gap-2 status-success">
              <div className="w-2 h-2 bg-success rounded-full" />
              <span className="font-medium text-sm sm:text-base">{demoStatus}</span>
            </div>
          </div>
        </div>
      )}
      {/* Hero Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:gap-6 mb-8 sm:mb-10 md:mb-12">
          <div className="professional-card text-center hover:border-info/50">
            <div className="text-lg sm:text-xl md:text-2xl font-bold status-info mb-1">256-bit</div>
            <div className="text-xs sm:text-sm text-muted-foreground">Encryption</div>
          </div>
          <div className="professional-card text-center hover:border-success/50">
            <div className="text-lg sm:text-xl md:text-2xl font-bold status-success mb-1">$2.4M</div>
            <div className="text-xs sm:text-sm text-muted-foreground">Volume Protected</div>
          </div>
          <div className="professional-card text-center hover:border-primary/50">
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-primary mb-1">5/5</div>
            <div className="text-xs sm:text-sm text-muted-foreground">Validators</div>
          </div>
          <div className="professional-card text-center hover:border-warning/50">
            <div className="text-lg sm:text-xl md:text-2xl font-bold status-warning mb-1">99.9%</div>
            <div className="text-xs sm:text-sm text-muted-foreground">MEV Protection</div>
          </div>
        </div>          {/* Main 3-Column Trading Interface */}
          <ClientOnly>
            <TradingInterface 
              orders={orders}
              matchedTrades={matchedTrades}
              isMatching={isMatching}
              onAddOrder={addOrder}
            />
          </ClientOnly>

          {/* Cryptographic Proofs Dashboard */}
          <div className="mt-8 sm:mt-10 md:mt-12">
            <ClientOnly>
              <CryptoProofsDashboard />
            </ClientOnly>
          </div>
      {/* Demo Controls removed from project */}
    </div>
  </main>
  </div>
  )
}