"use client";

import { Wallet, Activity, Zap } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import Image from 'next/image';

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-[#00f0ff]/20 bg-gradient-to-r from-[#0a0118]/95 via-[#1a0b2e]/95 to-[#0a0118]/95 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-6" style={{height: '84px'}}>
        <div className="flex items-center justify-between" style={{height: '84px'}}>
          {/* Logo Section */}
          <div className="flex items-center gap-2">
            <div className="relative hover:scale-105 transition-all duration-300 animate-float" style={{border: 'none', background: 'transparent', padding: '0'}}>
              <Image 
                src="/navbarlogo.svg" 
                alt="PhantomPool Logo" 
                width={88} 
                height={88}
                className="filter drop-shadow-lg"
                style={{border: 'none', background: 'transparent'}}
              />
              <div className="absolute top-1 right-1 w-4 h-4 bg-[#00ff88] rounded-full flex items-center justify-center animate-pulse shadow-lg shadow-[#00ff88]/50">
                <div className="w-2 h-2 bg-white rounded-full" />
              </div>
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-[#00f0ff] to-[#ff00e5] bg-clip-text text-transparent">
                PhantomPool
              </h1>
              <p className="text-sm text-[#b4b4b4] -mt-1">Zero-Knowledge Dark Pool</p>
            </div>
          </div>

          {/* Status Indicators */}
          <div className="flex items-center gap-4">
            {/* Encryption Status */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#00ff88]/10 border border-[#00ff88]/30 backdrop-blur-sm">
              <div className="relative">
                <Zap className="w-4 h-4 text-[#00ff88]" />
                <div className="absolute inset-0 w-4 h-4 text-[#00ff88] animate-ping opacity-30">
                  <Zap className="w-4 h-4" />
                </div>
              </div>
              <span className="text-[#00ff88] text-sm font-medium">Encryption Active</span>
            </div>

            {/* Network Badge */}
            <Badge className="bg-[#ff00e5]/10 border-[#ff00e5]/30 text-[#ff00e5] hover:bg-[#ff00e5]/20 gap-2 px-3 py-1">
              <Activity className="w-3 h-3" />
              Solana Devnet
            </Badge>

            {/* Connect Wallet Button */}
            <Button className="bg-gradient-to-r from-[#00f0ff] to-[#ff00e5] hover:from-[#00f0ff]/90 hover:to-[#ff00e5]/90 text-white border-0 px-6 py-2 rounded-xl font-medium transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-[#00f0ff]/25">
              <Wallet className="w-4 h-4 mr-2" />
              Connect Wallet
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
