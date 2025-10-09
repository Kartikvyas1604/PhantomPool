'use client';

import { useState } from 'react';
import { Header } from '@/components/Header'
import { TradingInterface } from '@/components/TradingInterface'
import { CryptoProofsDashboard } from '@/components/CryptoProofsDashboard'
import { ClientOnly } from '@/components/ClientOnly'
import { ElGamalService } from '@/crypto/elgamal.service'


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
  const [orders, setOrders] = useState<Order[]>([])

  const [matchedTrades] = useState<Trade[]>([])
  const [isMatching] = useState(false)
  const [demoStatus, setDemoStatus] = useState<string | null>(null)

  const addOrder = (order: Omit<Order, 'id'>) => {
    const keyPair = ElGamalService.generateKeyPair()
    const amountBig = BigInt(Math.floor(parseFloat(order.amount.replace(' SOL', '')) * 100))
    
    const encryptedAmount = ElGamalService.encrypt(keyPair.pk, amountBig)
    
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



  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Header />
      
      {/* Status Bar */}
      {demoStatus && (
        <div className="border-b border-slate-800 bg-emerald-950/20">
          <div className="max-w-full mx-auto px-4 py-2">
            <div className="flex items-center gap-2 text-emerald-400 text-sm">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span>{demoStatus}</span>
            </div>
          </div>
        </div>
      )}

      {/* Professional Trading Terminal Layout */}
      <div className="flex flex-col h-screen">
        {/* Top Stats Bar */}
        <div className="border-b border-slate-800 bg-slate-900/50 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-slate-700 rounded-full flex items-center justify-center">
                  <span className="text-xs font-bold">S</span>
                </div>
                <span className="font-semibold">SOL/USDC</span>
                <span className="text-slate-400 text-sm">Perpetual</span>
              </div>
              <div className="flex items-center gap-6 text-sm">
                <div>
                  <span className="text-slate-400">Mark: </span>
                  <span className="text-emerald-400 font-mono">$149.50</span>
                </div>
                <div>
                  <span className="text-slate-400">24h: </span>
                  <span className="text-emerald-400">+2.34%</span>
                </div>
                <div>
                  <span className="text-slate-400">Vol: </span>
                  <span className="font-mono">$0</span>
                </div>
                <div>
                  <span className="text-slate-400">Orders: </span>
                  <span className="font-mono">{orders.length}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
                <span className="text-emerald-400">256-bit Encrypted</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                <span className="text-blue-400">MEV Protected</span>
              </div>
            </div>
          </div>
        </div>

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

        {/* Bottom Security Status */}
        <div className="border-t border-slate-800 bg-slate-900/30 px-4 py-2">
          <ClientOnly>
            <CryptoProofsDashboard />
          </ClientOnly>
        </div>
      </div>
    </div>
  )
}