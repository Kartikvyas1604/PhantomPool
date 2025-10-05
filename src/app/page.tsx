'use client'

import { useState } from 'react'
import { Header } from '@/components/Header'
import { TradingInterface } from '@/components/TradingInterface'
import { CryptoProofsDashboard } from '@/components/CryptoProofsDashboard'
import { SplineBackground } from '@/components/SplineBackground'

export default function HomePage() {
  const [orders, setOrders] = useState([
    { id: 1, trader: 'Whale #1', amount: '250 SOL', price: '149.50', encrypted: 'ElG:8a9f...3d2e', status: 'pending', type: 'buy', timestamp: Date.now() },
    { id: 2, trader: 'Whale #2', amount: '180 SOL', price: '150.20', encrypted: 'ElG:7c4b...9a1f', status: 'pending', type: 'sell', timestamp: Date.now() },
    { id: 3, trader: 'Whale #3', amount: '320 SOL', price: '149.80', encrypted: 'ElG:2e8d...5c7a', status: 'pending', type: 'buy', timestamp: Date.now() },
  ])

  const [matchedTrades, setMatchedTrades] = useState<any[]>([])
  const [isMatching, setIsMatching] = useState(false)
  const [demoStatus, setDemoStatus] = useState<string | null>(null)

  const addOrder = (order: any) => {
    const newOrder = { 
      ...order, 
      id: orders.length + 1, 
      status: 'pending',
      timestamp: Date.now()
    }
    setOrders([...orders, newOrder])
    setDemoStatus('New encrypted order submitted 🔒')
    setTimeout(() => setDemoStatus(null), 3000)
  }

  const simulateTraders = () => {
    const newOrders = [
      { id: orders.length + 1, trader: 'Whale #4', amount: '500 SOL', price: '150.00', encrypted: 'ElG:4f8a...7d2c', status: 'pending', type: 'buy', timestamp: Date.now() },
      { id: orders.length + 2, trader: 'Whale #5', amount: '350 SOL', price: '149.90', encrypted: 'ElG:9c2b...5a1e', status: 'pending', type: 'sell', timestamp: Date.now() },
      { id: orders.length + 3, trader: 'Whale #6', amount: '275 SOL', price: '150.10', encrypted: 'ElG:1d7e...8f3b', status: 'pending', type: 'buy', timestamp: Date.now() },
      { id: orders.length + 4, trader: 'Whale #7', amount: '425 SOL', price: '149.95', encrypted: 'ElG:6a3f...2c9d', status: 'pending', type: 'sell', timestamp: Date.now() },
      { id: orders.length + 5, trader: 'Whale #8', amount: '190 SOL', price: '150.05', encrypted: 'ElG:3e9c...4b7a', status: 'pending', type: 'buy', timestamp: Date.now() },
    ]
    
    setOrders([...orders, ...newOrders])
    setDemoStatus('5 traders submitted encrypted orders ✅')
    setTimeout(() => setDemoStatus(null), 3000)
  }

  const matchOrders = () => {
    setIsMatching(true)
    setDemoStatus('VRF shuffling orders for fairness...')
    
    setTimeout(() => {
      setDemoStatus('Computing fair clearing price with ZK proofs...')
    }, 2000)

    setTimeout(() => {
      // Simulate matching
      const buyOrders = orders.filter(o => o.type === 'buy')
      const sellOrders = orders.filter(o => o.type === 'sell')
      
      const matched = buyOrders.slice(0, Math.min(buyOrders.length, sellOrders.length)).map((buy, idx) => ({
        id: Date.now() + idx,
        buyOrder: buy.trader,
        sellOrder: sellOrders[idx]?.trader || 'Anonymous',
        amount: buy.amount,
        clearingPrice: '149.95',
        timestamp: Date.now(),
        zkProof: true
      }))

      setMatchedTrades([...matched, ...matchedTrades])
      setOrders(orders.map(o => ({ ...o, status: 'matched' })))
      setDemoStatus('Orders matched at fair clearing price! Executing via Jupiter...')
      setIsMatching(false)
      
      setTimeout(() => setDemoStatus(null), 4000)
    }, 5000)
  }

  const resetDemo = () => {
    setOrders([])
    setMatchedTrades([])
    setDemoStatus('Demo reset')
    setTimeout(() => setDemoStatus(null), 2000)
  }

  return (
    <div className="min-h-screen bg-[#0a0118] relative overflow-hidden">
      {/* Spline 3D Background */}
      <SplineBackground />
      
      {/* Gradient Overlays */}
      <div className="fixed inset-0 bg-gradient-to-br from-[#0a0118] via-[#1a0b2e] to-[#0a0118] pointer-events-none" />
      
      {/* Content */}
      <div className="relative z-10">
        <Header />
        
        <main className="max-w-[1920px] mx-auto px-6 py-8">
          <TradingInterface 
            orders={orders}
            matchedTrades={matchedTrades}
            isMatching={isMatching}
            onAddOrder={addOrder}
          />
          
          <div className="mt-12">
            <CryptoProofsDashboard />
          </div>
        </main>

        {/* Demo Controls removed from project */}
      </div>
    </div>
  )
}