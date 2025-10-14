'use client';

import { Wallet, Activity, Settings, Zap, ChevronDown, AlertCircle } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { useEffect, useState } from 'react';
import { PhantomWalletService, WalletState } from '../services/phantom-wallet.service';


interface HeaderProps {
  onShowTutorial?: () => void;
}

export function Header({ onShowTutorial }: HeaderProps = {}) {
  const [walletState, setWalletState] = useState<WalletState>({
    isConnected: false,
    publicKey: null,
    balance: 0,
    isPhantomInstalled: false
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [isRequestingAirdrop, setIsRequestingAirdrop] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const walletService = PhantomWalletService.getInstance();

  useEffect(() => {
    // Check wallet state on component mount
    const currentState = walletService.getWalletState();
    setWalletState(currentState);

    // Try to auto-connect if previously connected
    walletService.connectIfTrusted().then((state) => {
      if (state) {
        setWalletState(state);
      }
    });

    // Listen for wallet events
    const handleWalletConnect = (state: WalletState) => {
      setWalletState(state);
      setError(null);
      setIsConnecting(false);
    };

    const handleWalletDisconnect = (state: WalletState) => {
      setWalletState(state);
      setError(null);
    };

    walletService.on('connect', handleWalletConnect);
    walletService.on('disconnect', handleWalletDisconnect);

    return () => {
      walletService.off('connect', handleWalletConnect);
      walletService.off('disconnect', handleWalletDisconnect);
    };
  }, []);

  const handleConnectWallet = async () => {
    try {
      setIsConnecting(true);
      setError(null);

      if (!walletState.isPhantomInstalled) {
        setError('Phantom wallet not installed');
        walletService.installPhantom();
        return;
      }

      const newState = await walletService.connect();
      setWalletState(newState);
    } catch (err: any) {
      setError(err.message || 'Failed to connect wallet');
      console.error('Wallet connection error:', err);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectWallet = async () => {
    try {
      await walletService.disconnect();
    } catch (err: any) {
      setError(err.message || 'Failed to disconnect wallet');
      console.error('Wallet disconnection error:', err);
    }
  };

  const handleRequestAirdrop = async () => {
    if (!walletState.isConnected || !walletState.publicKey) {
      setError('Please connect your wallet first');
      return;
    }

    setIsRequestingAirdrop(true);
    setError(null);

    try {
      const walletService = PhantomWalletService.getInstance();
      const result = await walletService.requestDevnetAirdrop(walletState.publicKey, 1);
      
      if (result.success) {
        // Wait a moment for the transaction to process
        setTimeout(async () => {
          const newBalance = await walletService.getBalance(walletState.publicKey!);
          setWalletState(prev => ({ ...prev, balance: newBalance }));
        }, 3000);
        
        setError('✅ Airdrop successful! 1 SOL added to your testnet wallet');
      } else {
        setError(`Airdrop failed: ${result.error}`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to request airdrop');
      console.error('Airdrop error:', err);
    } finally {
      setIsRequestingAirdrop(false);
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  return (
    <header className="border-b border-slate-800/50 bg-black px-4 py-2 h-20">
      <div className="flex items-center justify-between h-full">
        {/* Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="text-xl font-bold text-white">PhantomPool</div>
          <div className="hidden md:flex items-center gap-2 text-xs">
            <Badge variant="outline" className="bg-emerald-900/30 text-emerald-400 border-emerald-600/30">
              <Activity className="w-3 h-3 mr-1" />
              Active
            </Badge>
            <Badge variant="outline" className="bg-blue-900/30 text-blue-400 border-blue-600/30">
              <Zap className="w-3 h-3 mr-1" />
              Devnet
            </Badge>
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Network Status */}
          <div className="hidden lg:flex items-center gap-2 text-sm">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
              <span className="text-slate-300">Connected</span>
            </div>
            <span className="text-slate-500">•</span>
            <span className="text-slate-400">TPS: 3,247</span>
          </div>

          {/* Help Tutorial Button (Testnet - shows as devnet) */}
          {(process.env.SOLANA_NETWORK === 'testnet' || process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.includes('testnet')) && onShowTutorial && (
            <Button 
              onClick={onShowTutorial}
              variant="ghost" 
              size="sm" 
              className="h-7 w-7 sm:h-8 sm:w-8 p-0 text-blue-400 hover:text-blue-300"
              title="Show Tutorial"
            >
              <span className="text-sm font-bold">?</span>
            </Button>
          )}

          {/* Settings */}
          <Button variant="ghost" size="sm" className="h-7 w-7 sm:h-8 sm:w-8 p-0 text-slate-400 hover:text-slate-200">
            <Settings className="w-3 h-3 sm:w-4 sm:h-4" />
          </Button>

          {/* Error Display */}
          {error && (
            <div className="flex items-center gap-1 text-xs text-red-400 bg-red-950/30 px-2 py-1 rounded border border-red-800/30">
              <AlertCircle className="w-3 h-3" />
              <span className="hidden sm:inline">{error}</span>
              <span className="sm:hidden">Error</span>
            </div>
          )}

          {/* Wallet Connection */}
          {!walletState.isConnected ? (
            <Button 
              onClick={handleConnectWallet}
              disabled={isConnecting}
              className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-3 sm:px-4 py-2 h-8 sm:h-9 text-sm"
            >
              <Wallet className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">
                {isConnecting ? 'Connecting...' : 
                 !walletState.isPhantomInstalled ? 'Install Phantom' : 'Connect'}
              </span>
              <span className="sm:hidden">
                {isConnecting ? '...' : 'Wallet'}
              </span>
            </Button>
          ) : (
            <div className="flex items-center gap-1 sm:gap-2">
              <div className="bg-slate-800 rounded-lg px-2 sm:px-3 py-1 sm:py-2 border border-slate-700">
                <div className="flex items-center gap-1 sm:gap-2">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
                  <span className="text-xs sm:text-sm font-mono text-slate-200">
                    {walletState.publicKey ? formatAddress(walletState.publicKey) : 'Connected'}
                  </span>
                  {walletState.balance > 0 && (
                    <span className="text-xs text-slate-400 hidden md:inline">
                      ({walletState.balance.toFixed(2)} SOL)
                    </span>
                  )}
                  <ChevronDown className="w-3 h-3 text-slate-400 hidden sm:block" />
                </div>
              </div>
              
              {/* Testnet Airdrop Button (shows as devnet) */}
              {(process.env.SOLANA_NETWORK === 'testnet' || process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.includes('testnet')) && (
                <Button 
                  onClick={handleRequestAirdrop}
                  disabled={isRequestingAirdrop}
                  variant="outline"
                  size="sm"
                  className="bg-blue-900/30 border-blue-600/30 text-blue-400 hover:bg-blue-800/30 disabled:opacity-50 text-xs px-2 sm:px-3"
                >
                  <Zap className="w-3 h-3 mr-1" />
                  <span className="hidden sm:inline">
                    {isRequestingAirdrop ? 'Getting SOL...' : 'Get SOL'}
                  </span>
                  <span className="sm:hidden">SOL</span>
                </Button>
              )}

              <Button 
                onClick={handleDisconnectWallet}
                variant="ghost" 
                size="sm"
                className="text-slate-400 hover:text-slate-200 text-xs sm:text-sm px-2 sm:px-3"
              >
                <span className="hidden sm:inline">Disconnect</span>
                <span className="sm:hidden">×</span>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}