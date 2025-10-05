'use client';


import { Wallet, Activity, Zap } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogOverlay, DialogTitle, DialogDescription } from './ui/dialog';


export function Header() {
  const [wallet, setWallet] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [showDisconnect, setShowDisconnect] = useState(false)

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
    setShowDisconnect(true)
  }

  const confirmDisconnect = async () => {
    setShowDisconnect(false)
    if (typeof window !== 'undefined' && window.solana?.isPhantom) {
      await window.solana?.disconnect()
      setWallet(null)
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[#00f0ff]/20 bg-gradient-to-r from-[#0a0118]/95 via-[#1a0b2e]/95 to-[#0a0118]/95 backdrop-blur-xl w-full min-w-0">
      <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 md:px-8 h-14 xs:h-16 sm:h-20 md:h-21 min-w-0">
        <div className="flex flex-wrap items-center justify-between h-full min-w-0">
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
              <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-2 w-full max-w-xs xs:max-w-none">
                <Button
                  onClick={e => {
                    if (window.innerWidth < 640) disconnect();
                  }}
                  disabled={window.innerWidth >= 640}
                  className="bg-gradient-to-r from-[#00f0ff] to-[#ff00e5] text-white border-0 px-2 xs:px-3 sm:px-4 md:px-6 py-2 rounded-xl font-medium text-xs xs:text-sm sm:text-base cursor-pointer truncate w-full xs:w-auto sm:cursor-default opacity-90 sm:opacity-90"
                  style={window.innerWidth < 640 ? { pointerEvents: 'auto' } : {}}
                >
                  <Wallet className="w-4 h-4 xs:mr-2" />
                  <span className="hidden xs:inline">{wallet.slice(0, 4)}...{wallet.slice(-4)}</span>
                  <span className="xs:hidden ml-1">{wallet.slice(0, 4)}...{wallet.slice(-4)}</span>
                </Button>
                <Button
                  onClick={disconnect}
                  className="hidden xs:inline-flex bg-gradient-to-r from-[#00f0ff] to-[#ff00e5] hover:from-[#00f0ff]/90 hover:to-[#ff00e5]/90 text-white border-0 px-2 xs:px-3 sm:px-4 py-2 rounded-xl font-medium text-xs xs:text-sm sm:text-base transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-[#00f0ff]/25 w-full xs:w-auto"
                >
                  <span className="truncate">Disconnect</span>
                </Button>
                <Dialog open={showDisconnect} onOpenChange={setShowDisconnect}>
                  <DialogOverlay className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-fadeIn" />
                  <DialogContent className="bg-gradient-to-br from-[#1a0b2e] to-[#0a0118] border border-[#00f0ff]/30 rounded-2xl shadow-2xl p-8 max-w-sm mx-auto animate-scaleIn">
                    <DialogTitle className="text-lg font-semibold text-white mb-2">Disconnect Wallet</DialogTitle>
                    <DialogDescription className="text-[#b4b4b4] mb-6">Are you sure you want to disconnect your wallet?</DialogDescription>
                    <div className="flex gap-4 justify-end">
                      <Button onClick={() => setShowDisconnect(false)} className="bg-[#232136] text-white px-4 py-2 rounded-xl font-medium text-sm transition-all duration-200 hover:bg-[#2a2740]">Cancel</Button>
                      <Button onClick={confirmDisconnect} className="bg-gradient-to-r from-[#00f0ff] to-[#ff00e5] text-white px-4 py-2 rounded-xl font-medium text-sm transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-[#00f0ff]/25">Disconnect</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            ) : (
              <Button onClick={connect} disabled={connecting} className="bg-gradient-to-r from-[#00f0ff] to-[#ff00e5] hover:from-[#00f0ff]/90 hover:to-[#ff00e5]/90 text-white border-0 px-2 xs:px-3 sm:px-4 md:px-6 py-2 rounded-xl font-medium transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-[#00f0ff]/25 text-xs xs:text-sm sm:text-base w-full xs:w-auto">
                <Wallet className="w-4 h-4 xs:mr-2" />
                <span className="hidden xs:inline">{connecting ? 'Connecting...' : 'Connect Wallet'}</span>
                <span className="xs:hidden ml-1">{connecting ? '...' : 'Connect'}</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
