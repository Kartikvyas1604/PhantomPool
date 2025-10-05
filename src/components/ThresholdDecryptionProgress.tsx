'use client';

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Card } from './ui/card';
import { Shield, CheckCircle, Lock } from 'lucide-react';

export function ThresholdDecryptionProgress() {
  const [executors] = useState([
    { id: 1, name: 'Executor Node 1', status: 'online', signed: true },
    { id: 2, name: 'Executor Node 2', status: 'online', signed: true },
    { id: 3, name: 'Executor Node 3', status: 'online', signed: true },
    { id: 4, name: 'Executor Node 4', status: 'online', signed: false },
    { id: 5, name: 'Executor Node 5', status: 'online', signed: false },
  ]);

  const signedCount = executors.filter(e => e.signed).length;
  const progress = (signedCount / 3) * 100; // 3-of-5 threshold

  return (
    <Card className="bg-white/5 border border-[#00f0ff]/20 backdrop-blur-xl p-6 relative overflow-hidden group hover:border-[#00f0ff]/40 transition-all duration-300">
      {/* Glow effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#ff00e5]/5 to-[#8b5cf6]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-[#ff00e5]/20 p-2 rounded-lg">
            <Shield className="w-5 h-5 text-[#ff00e5]" />
          </div>
          <div className="flex-1">
            <h3 className="text-white">Threshold Decryption</h3>
            <p className="text-[#b4b4b4] text-sm">3-of-5 Multi-party Computation</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2 text-sm">
            <span className="text-[#b4b4b4]">Decryption Progress</span>
            <span className="text-white">{signedCount}/3 Required</span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(progress, 100)}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-[#ff00e5] to-[#8b5cf6]"
            />
          </div>
        </div>

        {/* Executor Nodes */}
        <div className="space-y-2">
          {executors.map((executor, index) => (
            <motion.div
              key={executor.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`flex items-center justify-between p-3 rounded-lg border ${
                executor.signed
                  ? 'bg-[#00ff88]/10 border-[#00ff88]/30'
                  : 'bg-white/5 border-white/10'
              }`}
            >
              <div className="flex items-center gap-3">
                {executor.signed ? (
                  <CheckCircle className="w-4 h-4 text-[#00ff88]" />
                ) : (
                  <Lock className="w-4 h-4 text-[#b4b4b4]" />
                )}
                <span className={`text-sm ${executor.signed ? 'text-white' : 'text-[#b4b4b4]'}`}>
                  {executor.name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  executor.status === 'online' ? 'bg-[#00ff88] animate-pulse' : 'bg-[#b4b4b4]'
                }`} />
                <span className="text-xs text-[#b4b4b4]">{executor.status}</span>
              </div>
            </motion.div>
          ))}
        </div>

        {signedCount >= 3 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 bg-[#00ff88]/10 border border-[#00ff88]/30 rounded-lg p-3 text-center"
          >
            <p className="text-[#00ff88] text-sm">✓ Threshold reached - Ready to execute</p>
          </motion.div>
        )}
      </div>
    </Card>
  );
}
