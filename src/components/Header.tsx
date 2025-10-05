"use client";

import { Wallet, Activity } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

export function Header() {
  return (
  <header className="site-header border-b border-[#00f0ff]/10 bg-black/0 relative z-20 sticky top-0">
  <div className="max-w-[1920px] mx-auto px-4" style={{height: 'var(--header-height)'}}>
        <div className="flex items-center justify-between h-full">
          <a href="/" className="brand no-underline" style={{gap: '4px'}}>
            <div className="logo-wrap relative animate-float">
              <div className="logo-inner overflow-hidden flex items-center justify-center" aria-hidden>
                <img src="/navbarlogo.png" alt="Phantom mascot" className="logo-img w-full h-full object-contain" />
              </div>
            </div>

            <div className="leading-tight">
              <h1 className="text-white text-base font-medium">PhantomPool</h1>
              <p className="text-[#00f0ff] text-[12px] -mt-0.5">Zero-Knowledge Dark Pool</p>
            </div>
          </a>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#00ff88]/10 border border-[#00ff88]/30">
              <div className="relative">
                <div className="w-2 h-2 bg-[#00ff88] rounded-full animate-pulse" />
                <div className="absolute inset-0 w-2 h-2 bg-[#00ff88] rounded-full animate-ping" />
              </div>
              <span className="text-[#00ff88] text-sm">Encryption Active</span>
            </div>

            <Badge variant="outline" className="border-[#ff00e5]/50 text-[#ff00e5] bg-[#ff00e5]/10 gap-2">
              <Activity className="w-3 h-3" />
              Solana Devnet
            </Badge>

            <Button className="bg-gradient-to-r from-[#00f0ff] to-[#ff00e5] hover:from-[#00f0ff]/80 hover:to-[#ff00e5]/80 text-white border-0">
              <Wallet className="w-4 h-4 mr-2" />
              Connect Wallet
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
