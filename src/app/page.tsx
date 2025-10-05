'use client'

import { useState } from 'react'
import { Header } from '@/components/Header'
import { TradingInterface } from '@/components/TradingInterface'
import { CryptoProofsDashboard } from '@/components/CryptoProofsDashboard'
import { SplineBackground } from '@/components/SplineBackground'
import { ClientOnly } from '@/components/ClientOnly'

export default function HomePage() {
  const [orders, setOrders] = useState([
    { id: 1, trader: 'Whale #1', amount: '250 SOL', price: '149.50', encrypted: 'ElG:8a9f...3d2e', status: 'pending', type: 'buy', timestamp: 1696521600000 },
    { id: 2, trader: 'Whale #2', amount: '180 SOL', price: '150.20', encrypted: 'ElG:7c4b...9a1f', status: 'pending', type: 'sell', timestamp: 1696521660000 },
    { id: 3, trader: 'Whale #3', amount: '320 SOL', price: '149.80', encrypted: 'ElG:2e8d...5c7a', status: 'pending', type: 'buy', timestamp: 1696521720000 },
  ])

  const [matchedTrades, setMatchedTrades] = useState<any[]>([])
  const [isMatching, setIsMatching] = useState(false)
  const [demoStatus, setDemoStatus] = useState<string | null>(null)

  const addOrder = (order: any) => {
    const newOrder = { 
      ...order, 
      id: orders.length + 1, 
      status: 'pending',
      timestamp: 1696521600000 + (orders.length * 60000)
    }
    setOrders([...orders, newOrder])
    setDemoStatus('🔒 New encrypted order submitted')
    setTimeout(() => setDemoStatus(null), 3000)
  }

  const simulateTraders = () => {
    const baseTime = 1696521600000;
    const newOrders = [
      { id: orders.length + 1, trader: 'Whale #4', amount: '500 SOL', price: '150.00', encrypted: 'ElG:4f8a...7d2c', status: 'pending', type: 'buy', timestamp: baseTime + (orders.length + 1) * 60000 },
      { id: orders.length + 2, trader: 'Whale #5', amount: '350 SOL', price: '149.90', encrypted: 'ElG:9c2b...5a1e', status: 'pending', type: 'sell', timestamp: baseTime + (orders.length + 2) * 60000 },
      { id: orders.length + 3, trader: 'Whale #6', amount: '275 SOL', price: '150.10', encrypted: 'ElG:1d7e...8f3b', status: 'pending', type: 'buy', timestamp: baseTime + (orders.length + 3) * 60000 },
      { id: orders.length + 4, trader: 'Whale #7', amount: '425 SOL', price: '149.95', encrypted: 'ElG:6a3f...2c9d', status: 'pending', type: 'sell', timestamp: baseTime + (orders.length + 4) * 60000 },
      { id: orders.length + 5, trader: 'Whale #8', amount: '190 SOL', price: '150.05', encrypted: 'ElG:3e9c...4b7a', status: 'pending', type: 'buy', timestamp: baseTime + (orders.length + 5) * 60000 },
    ]
    
    setOrders([...orders, ...newOrders])
    setDemoStatus('✅ 5 traders submitted encrypted orders')
    setTimeout(() => setDemoStatus(null), 3000)
  }

  const matchOrders = () => {
    setIsMatching(true)
    setDemoStatus('🎲 VRF shuffling orders for fairness...')
    
    setTimeout(() => {
      setDemoStatus('🔐 Computing fair clearing price with ZK proofs...')
    }, 2000)

    setTimeout(() => {
      // Simulate matching
      const buyOrders = orders.filter(o => o.type === 'buy')
      const sellOrders = orders.filter(o => o.type === 'sell')
      
      const baseTime = 1696521600000;
      const matched = buyOrders.slice(0, Math.min(buyOrders.length, sellOrders.length)).map((buy, idx) => ({
        id: baseTime + idx,
        buyOrder: buy.trader,
        sellOrder: sellOrders[idx]?.trader || 'Anonymous',
        amount: buy.amount,
        clearingPrice: '149.95',
        timestamp: baseTime + (idx * 30000),
        zkProof: true
      }))

      setMatchedTrades([...matched, ...matchedTrades])
      setOrders(orders.map(o => ({ ...o, status: 'matched' })))
      setDemoStatus('🚀 Orders matched! Executing via Jupiter...')
      setIsMatching(false)
      
      setTimeout(() => setDemoStatus(null), 4000)
    }, 5000)
  }

  const resetDemo = () => {
    setOrders([])
    setMatchedTrades([])
    setDemoStatus('🔄 Demo reset')
    setTimeout(() => setDemoStatus(null), 2000)
  }

  return (
    <div className="min-h-screen bg-[#0a0118] relative overflow-hidden">
      {/* Spline 3D Background */}
      <ClientOnly>
        <SplineBackground />
      </ClientOnly>
      
      {/* Gradient Overlays */}
      <div className="fixed inset-0 bg-gradient-to-br from-[#0a0118] via-[#1a0b2e] to-[#0a0118] pointer-events-none" />
      
      {/* Content */}
      <div className="relative z-10">
        <Header />
        
        {/* Demo Status Bar */}
        {demoStatus && (
          <div className="max-w-7xl mx-auto px-6 py-2">
            <div className="bg-gradient-to-r from-[#00ff88]/10 to-[#00ff88]/5 border border-[#00ff88]/30 backdrop-blur-xl rounded-xl p-3 flex items-center justify-center">
              <div className="flex items-center gap-2 text-[#00ff88]">
                <div className="w-2 h-2 bg-[#00ff88] rounded-full animate-pulse" />
                <span className="font-medium">{demoStatus}</span>
              </div>
            </div>
          </div>
        )}
        
        <main className="max-w-7xl mx-auto px-6 py-8">
          {/* Hero Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
            <div className="bg-gradient-to-br from-[#00f0ff]/10 to-[#00f0ff]/5 border border-[#00f0ff]/20 backdrop-blur-xl rounded-xl p-6 text-center">
              <div className="text-2xl font-bold text-[#00f0ff] mb-1">256-bit</div>
              <div className="text-sm text-[#b4b4b4]">Encryption</div>
            </div>
            <div className="bg-gradient-to-br from-[#00ff88]/10 to-[#00ff88]/5 border border-[#00ff88]/20 backdrop-blur-xl rounded-xl p-6 text-center">
              <div className="text-2xl font-bold text-[#00ff88] mb-1">$2.4M</div>
              <div className="text-sm text-[#b4b4b4]">Volume Protected</div>
            </div>
            <div className="bg-gradient-to-br from-[#ff00e5]/10 to-[#ff00e5]/5 border border-[#ff00e5]/20 backdrop-blur-xl rounded-xl p-6 text-center">
              <div className="text-2xl font-bold text-[#ff00e5] mb-1">5/5</div>
              <div className="text-sm text-[#b4b4b4]">Validators</div>
            </div>
            <div className="bg-gradient-to-br from-[#ffaa00]/10 to-[#ffaa00]/5 border border-[#ffaa00]/20 backdrop-blur-xl rounded-xl p-6 text-center">
              <div className="text-2xl font-bold text-[#ffaa00] mb-1">99.9%</div>
              <div className="text-sm text-[#b4b4b4]">MEV Protection</div>
            </div>
          </div>

          {/* Main 3-Column Trading Interface */}
          <ClientOnly>
            <TradingInterface 
              orders={orders}
              matchedTrades={matchedTrades}
              isMatching={isMatching}
              onAddOrder={addOrder}
            />
          </ClientOnly>

          {/* Cryptographic Proofs Dashboard */}
          <div className="mt-12">
            <ClientOnly>
              <CryptoProofsDashboard />
            </ClientOnly>
          </div>
        </main>

        {/* Demo Controls removed from project */}
      </div>
    </div>
  )
}