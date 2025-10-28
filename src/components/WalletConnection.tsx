'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { PublicKey } from '@solana/web3.js';

// Phantom wallet interface
interface PhantomProvider {
  isPhantom?: boolean;
  connect(options?: any): Promise<{ publicKey: PublicKey }>;
  disconnect(): Promise<void>;
  on(event: string, callback: Function): void;
  publicKey?: PublicKey;
}

interface WalletState {
  connected: boolean;
  publicKey: string | null;
  connecting: boolean;
}

export const WalletConnection: React.FC = () => {
  const [wallet, setWallet] = useState<WalletState>({
    connected: false,
    publicKey: null,
    connecting: false
  });

  useEffect(() => {
    const checkIfWalletIsConnected = async () => {
      try {
        const solana = (window as any).solana as PhantomProvider;
        if (solana && solana.isPhantom) {
          const response = await solana.connect({ onlyIfTrusted: true });
          if (response.publicKey) {
            setWallet({
              connected: true,
              publicKey: response.publicKey.toString(),
              connecting: false
            });
          }
        }
      } catch (error) {
        console.log('Wallet not connected');
      }
    };

    checkIfWalletIsConnected();
  }, []);

  const connectWallet = async () => {
    try {
      setWallet(prev => ({ ...prev, connecting: true }));
      
      const solana = (window as any).solana as PhantomProvider;
      if (!solana || !solana.isPhantom) {
        alert('Phantom wallet not found! Please install Phantom wallet.');
        setWallet(prev => ({ ...prev, connecting: false }));
        return;
      }

      const response = await solana.connect();
      setWallet({
        connected: true,
        publicKey: response.publicKey.toString(),
        connecting: false
      });
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      setWallet({
        connected: false,
        publicKey: null,
        connecting: false
      });
    }
  };

  const disconnectWallet = async () => {
    try {
      const solana = (window as any).solana as PhantomProvider;
      if (solana) {
        await solana.disconnect();
      }
      setWallet({
        connected: false,
        publicKey: null,
        connecting: false
      });
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
    }
  };

  const formatAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  return (
    <div className="flex items-center space-x-3">
      {!wallet.connected ? (
        <Button 
          onClick={connectWallet}
          disabled={wallet.connecting}
          className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-medium px-6 py-2 rounded-lg shadow-lg transition-all duration-200 hover:shadow-xl"
        >
          {wallet.connecting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Connecting...
            </>
          ) : (
            <>
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              Connect Phantom Wallet
            </>
          )}
        </Button>
      ) : (
        <div className="flex items-center space-x-3">
          <div className="flex items-center bg-gray-800 rounded-lg px-4 py-2 border border-gray-600">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
            <span className="text-green-400 font-mono text-sm">
              {formatAddress(wallet.publicKey || '')}
            </span>
          </div>
          <Button
            onClick={disconnectWallet}
            variant="outline"
            size="sm"
            className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
          >
            Disconnect
          </Button>
        </div>
      )}
    </div>
  );
};