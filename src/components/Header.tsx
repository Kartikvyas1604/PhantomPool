'use client';


import { Wallet, Activity, Zap } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import Image from 'next/image';
import { useEffect, useState } from 'react';


export function Header() {
  const [wallet, setWallet] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && window.solana?.isPhantom) {
      window.solana?.on('connect', () => {
        setWallet(window.solana?.publicKey?.toString() || null)
      })
      window.solana?.on('disconnect', () => {
        setWallet(null)
      })
      if (window.solana?.isConnected) {
        setWallet(window.solana?.publicKey?.toString() || null)
      }
    }
  }, [])

  const connect = async () => {
    setConnecting(true)
    try {
      if (typeof window !== 'undefined' && window.solana?.isPhantom) {
        const resp = await window.solana?.connect()
        setWallet(resp?.publicKey?.toString() || null)
      } else {
        window.open('https://phantom.app/', '_blank')
      }
    } finally {
      setConnecting(false)
    }
  }

  const disconnect = async () => {
    if (typeof window !== 'undefined' && window.solana?.isPhantom) {
      await window.solana?.disconnect()
      setWallet(null)
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[#00f0ff]/20 bg-gradient-to-r from-[#0a0118]/95 via-[#1a0b2e]/95 to-[#0a0118]/95 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 md:h-21">
        <div className="flex items-center justify-between h-full">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative hover:scale-105 transition-all duration-300 animate-float">
              <Image 
                src="/navbarlogo.svg" 
                alt="PhantomPool Logo" 
                width={48} 
                height={48}
                className="filter drop-shadow-lg sm:w-16 sm:h-16 md:w-[72px] md:h-[72px]"
              />
            </div>
            <div>
              <h1 className="text-sm sm:text-lg md:text-xl font-bold bg-gradient-to-r from-[#00f0ff] to-[#ff00e5] bg-clip-text text-transparent">
                PhantomPool
              </h1>
              <p className="text-xs sm:text-sm text-[#b4b4b4] -mt-1 hidden sm:block">Zero-Knowledge Dark Pool</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
            <div className="hidden lg:flex items-center gap-2 px-3 py-2 rounded-xl bg-[#00ff88]/10 border border-[#00ff88]/30 backdrop-blur-sm">
              <div className="relative">
                <Zap className="w-4 h-4 text-[#00ff88]" />
                <div className="absolute inset-0 w-4 h-4 text-[#00ff88] animate-ping opacity-30">
                  <Zap className="w-4 h-4" />
                </div>
              </div>
              <span className="text-[#00ff88] text-sm font-medium">Encryption Active</span>
            </div>
            <Badge className="hidden md:flex bg-[#ff00e5]/10 border-[#ff00e5]/30 text-[#ff00e5] hover:bg-[#ff00e5]/20 gap-2 px-2 sm:px-3 py-1">
              <Activity className="w-3 h-3" />
              <span className="hidden sm:inline">Solana Devnet</span>
              <span className="sm:hidden">Devnet</span>
            </Badge>
            {wallet ? (
              <Button onClick={disconnect} className="bg-gradient-to-r from-[#00f0ff] to-[#ff00e5] text-white border-0 px-3 sm:px-4 md:px-6 py-2 rounded-xl font-medium transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-[#00f0ff]/25 text-sm sm:text-base">
                <Wallet className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">{wallet.slice(0, 4)}...{wallet.slice(-4)}</span>
                <span className="sm:hidden ml-1">{wallet.slice(0, 4)}...{wallet.slice(-4)}</span>
              </Button>
            ) : (
              <Button onClick={connect} disabled={connecting} className="bg-gradient-to-r from-[#00f0ff] to-[#ff00e5] hover:from-[#00f0ff]/90 hover:to-[#ff00e5]/90 text-white border-0 px-3 sm:px-4 md:px-6 py-2 rounded-xl font-medium transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-[#00f0ff]/25 text-sm sm:text-base">
                <Wallet className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">{connecting ? 'Connecting...' : 'Connect Wallet'}</span>
                <span className="sm:hidden ml-1">{connecting ? '...' : 'Connect'}</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
