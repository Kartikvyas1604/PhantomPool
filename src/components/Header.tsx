'use client';

import { Wallet, Activity, Settings, Zap, ChevronDown } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { useEffect, useState } from 'react';
import Image from 'next/image';

export function Header() {
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  useEffect(() => {
    // Mock wallet connection status
    setIsWalletConnected(false);
    setWalletAddress(null);
  }, []);

  const handleConnectWallet = () => {
    // Mock wallet connection
    setIsWalletConnected(true);
    setWalletAddress('7k8i...9mNx');
  };

  const handleDisconnectWallet = () => {
    setIsWalletConnected(false);
    setWalletAddress(null);
  };

  return (
    <header className="border-b border-slate-800 bg-slate-900 px-4 py-3">
      <div className="flex items-center justify-between">
        {/* Logo & Title */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <Image 
              src="/logo-navbar.svg" 
              alt="PhantomPool Logo" 
              width={200} 
              height={40}
              className="h-10 w-auto"
            />
          </div>
          
          {/* Status Badges */}
          <div className="hidden md:flex items-center gap-3">
            <Badge variant="outline" className="bg-emerald-900/30 text-emerald-400 border-emerald-600/30">
              <Activity className="w-3 h-3 mr-1" />
              Encryption Active
            </Badge>
            <Badge variant="outline" className="bg-blue-900/30 text-blue-400 border-blue-600/30">
              <Zap className="w-3 h-3 mr-1" />
              Solana Devnet
            </Badge>
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-4">
          {/* Network Status */}
          <div className="hidden lg:flex items-center gap-2 text-sm">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
              <span className="text-slate-300">Connected</span>
            </div>
            <span className="text-slate-500">•</span>
            <span className="text-slate-400">TPS: 3,247</span>
          </div>

          {/* Settings */}
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-slate-200">
            <Settings className="w-4 h-4" />
          </Button>

          {/* Wallet Connection */}
          {!isWalletConnected ? (
            <Button 
              onClick={handleConnectWallet}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 h-9"
            >
              <Wallet className="w-4 h-4 mr-2" />
              Connect
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <div className="bg-slate-800 rounded-lg px-3 py-2 border border-slate-700">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
                  <span className="text-sm font-mono text-slate-200">{walletAddress}</span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </div>
              </div>
              <Button 
                onClick={handleDisconnectWallet}
                variant="ghost" 
                size="sm"
                className="text-slate-400 hover:text-slate-200"
              >
                Disconnect
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}