'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Lock, TrendingUp, TrendingDown } from 'lucide-react';
import { Badge } from './ui/badge';

export function TradingForm({ onSubmit }: { onSubmit: (order: any) => void }) {
  const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const [price, setPrice] = useState('');
  const [encrypting, setEncrypting] = useState(false);
  const [encryptedPreview, setEncryptedPreview] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEncrypting(true);
    
    // Simulate encryption
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const encryptedHash = `ElG:${Math.random().toString(36).substring(2, 6)}...${Math.random().toString(36).substring(2, 6)}`;
    setEncryptedPreview(encryptedHash);
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    onSubmit({
      trader: `Whale #${Math.floor(Math.random() * 100)}`,
      amount: `${amount} SOL`,
      price: price,
      encrypted: encryptedHash,
      type: orderType,
    });
    
    setEncrypting(false);
    setAmount('');
    setPrice('');
    setEncryptedPreview(null);
  };

  return (
    <Card className="bg-white/5 border border-[#00f0ff]/20 backdrop-blur-xl p-6 relative overflow-hidden group hover:border-[#00f0ff]/40 transition-all duration-300">
      {/* Glow effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#00f0ff]/5 to-[#ff00e5]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-white mb-1">Order Entry</h3>
            <p className="text-[#b4b4b4] text-sm">SOL/USDC</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-[#b4b4b4]">
            <Lock className="w-4 h-4 text-[#00f0ff]" />
            <span>MEV Protected</span>
          </div>
        </div>

        {/* Order Type Tabs */}
        <div className="grid grid-cols-2 gap-2 mb-6 p-1 bg-white/5 rounded-lg">
          <button
            onClick={() => setOrderType('buy')}
            className={`py-2.5 rounded-md transition-all duration-300 ${
              orderType === 'buy'
                ? 'bg-gradient-to-r from-[#00f0ff] to-[#00f0ff]/80 text-white shadow-lg shadow-[#00f0ff]/20'
                : 'text-[#b4b4b4] hover:text-white'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Buy
            </div>
          </button>
          <button
            onClick={() => setOrderType('sell')}
            className={`py-2.5 rounded-md transition-all duration-300 ${
              orderType === 'sell'
                ? 'bg-gradient-to-r from-[#ff00e5] to-[#ff00e5]/80 text-white shadow-lg shadow-[#ff00e5]/20'
                : 'text-[#b4b4b4] hover:text-white'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <TrendingDown className="w-4 h-4" />
              Sell
            </div>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-[#b4b4b4]">Amount (SOL)</Label>
              <span className="text-[#b4b4b4] text-xs">Balance: 1,234.56 SOL</span>
            </div>
            <Input
              type="number"
              placeholder="100"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="bg-white/5 border-[#00f0ff]/20 text-white placeholder:text-white/30 focus:border-[#00f0ff]/50 transition-colors"
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-[#b4b4b4]">Limit Price (USDC)</Label>
              <span className="text-[#00ff88] text-xs">Market: $150.23</span>
            </div>
            <Input
              type="number"
              step="0.01"
              placeholder="150.00"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="bg-white/5 border-[#00f0ff]/20 text-white placeholder:text-white/30 focus:border-[#00f0ff]/50 transition-colors"
              required
            />
          </div>

          {/* Encrypted Preview */}
          {encryptedPreview && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#00ff88]/10 border border-[#00ff88]/30 rounded-lg p-4"
            >
              <p className="text-[#00ff88] text-sm mb-2">🔒 Order Encrypted</p>
              <p className="text-white/70 text-xs font-mono break-all">{encryptedPreview}</p>
            </motion.div>
          )}

          {/* Privacy Guarantee */}
          <div className="bg-[#00f0ff]/10 border border-[#00f0ff]/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-[#00f0ff] mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[#00f0ff] text-sm mb-1">ElGamal Encryption</p>
                <p className="text-[#00f0ff]/70 text-xs leading-relaxed">
                  Your order is homomorphically encrypted. MEV bots and other traders cannot see your order details until execution.
                </p>
              </div>
            </div>
          </div>

          <Button
            type="submit"
            disabled={encrypting || !amount || !price}
            className={`w-full ${
              orderType === 'buy'
                ? 'bg-gradient-to-r from-[#00f0ff] to-[#00f0ff]/80 hover:from-[#00f0ff]/90 hover:to-[#00f0ff]/70'
                : 'bg-gradient-to-r from-[#ff00e5] to-[#ff00e5]/80 hover:from-[#ff00e5]/90 hover:to-[#ff00e5]/70'
            } text-white border-0 shadow-lg ${
              orderType === 'buy' ? 'shadow-[#00f0ff]/20' : 'shadow-[#ff00e5]/20'
            }`}
          >
            {encrypting ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="flex items-center gap-2"
              >
                <Lock className="w-4 h-4" />
                Encrypting Order...
              </motion.div>
            ) : (
              <>
                <Lock className="w-4 h-4 mr-2" />
                Encrypt & Submit Order
              </>
            )}
          </Button>
        </form>

        {/* Network Fee */}
        <div className="mt-6 pt-6 border-t border-white/10 flex items-center justify-between text-sm">
          <span className="text-[#b4b4b4]">Network Fee</span>
          <span className="text-white">0.0001 SOL</span>
        </div>
      </div>
    </Card>
  );
}
