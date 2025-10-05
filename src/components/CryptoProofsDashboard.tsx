'use client';

import { motion } from 'motion/react';
import { Card } from './ui/card';
import { Shield, Lock, Shuffle, Unlock, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

export function CryptoProofsDashboard() {
  const proofs = [
    {
      title: 'ElGamal Encryption',
      description: 'Active orders encrypted',
      icon: Lock,
      color: 'from-[#00f0ff] to-[#00f0ff]/80',
      borderColor: 'border-[#00f0ff]/30',
      bgColor: 'bg-[#00f0ff]/10',
      status: 'Active',
      details: 'Homomorphic encryption allows computation on encrypted data without decryption. 2048-bit key strength.',
      metrics: {
        'Encrypted Orders': '12',
        'Encryption Time': '< 100ms',
        'Key Strength': '2048-bit'
      }
    },
    {
      title: 'Bulletproofs+ Solvency',
      description: 'All traders solvent',
      icon: Shield,
      color: 'from-[#00ff88] to-[#00ff88]/80',
      borderColor: 'border-[#00ff88]/30',
      bgColor: 'bg-[#00ff88]/10',
      status: 'Verified',
      details: 'Zero-knowledge range proofs ensure all traders have sufficient balance without revealing amounts.',
      metrics: {
        'Traders Verified': '8',
        'Proof Size': '2.4 KB',
        'Verification': '12ms'
      }
    },
    {
      title: 'VRF Fairness',
      description: 'Random shuffle verified',
      icon: Shuffle,
      color: 'from-[#ff00e5] to-[#ff00e5]/80',
      borderColor: 'border-[#ff00e5]/30',
      bgColor: 'bg-[#ff00e5]/10',
      status: 'Verified',
      details: 'Verifiable Random Function ensures unpredictable, fair order sequencing that cannot be manipulated.',
      metrics: {
        'Randomness Source': 'VRF',
        'Shuffle Verified': 'Yes',
        'Proof Size': '1.8 KB'
      }
    },
    {
      title: 'Threshold Network',
      description: '5/5 executors online',
      icon: Unlock,
      color: 'from-[#8b5cf6] to-[#8b5cf6]/80',
      borderColor: 'border-[#8b5cf6]/30',
      bgColor: 'bg-[#8b5cf6]/10',
      status: 'Online',
      details: '3-of-5 threshold signature scheme using Shamir Secret Sharing prevents single point of failure.',
      metrics: {
        'Active Nodes': '5/5',
        'Threshold': '3-of-5',
        'Uptime': '99.9%'
      }
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-white mb-2">Cryptographic Proofs Dashboard</h2>
        <p className="text-[#b4b4b4]">Real-time verification of all security guarantees</p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {proofs.map((proof, index) => (
          <motion.div
            key={proof.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Card className={`bg-white/5 border ${proof.borderColor} backdrop-blur-xl p-6 relative overflow-hidden group hover:border-opacity-60 transition-all duration-300 cursor-pointer`}>
                      {/* Animated glow */}
                      <motion.div
                        className={`absolute inset-0 bg-gradient-to-br ${proof.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}
                        animate={{
                          opacity: [0.05, 0.1, 0.05],
                        }}
                        transition={{
                          duration: 3,
                          repeat: Infinity,
                          ease: 'easeInOut',
                        }}
                      />

                      <div className="relative z-10">
                        {/* Icon and Status */}
                        <div className="flex items-start justify-between mb-4">
                          <div className={`bg-gradient-to-br ${proof.color} p-3 rounded-lg shadow-lg`}>
                            <proof.icon className="w-6 h-6 text-white" />
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-[#00ff88] rounded-full animate-pulse" />
                            <span className="text-[#00ff88] text-xs">{proof.status}</span>
                          </div>
                        </div>

                        {/* Title and Description */}
                        <div className="mb-4">
                          <h3 className="text-white mb-1">{proof.title}</h3>
                          <p className="text-[#b4b4b4] text-sm">{proof.description}</p>
                        </div>

                        {/* Info Icon */}
                        <div className="flex items-center gap-2 text-[#00f0ff] text-xs">
                          <Info className="w-3 h-3" />
                          <span>Hover for details</span>
                        </div>
                      </div>
                    </Card>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="bg-[#1a0b2e] border border-[#00f0ff]/30 p-4 max-w-xs">
                  <div className="space-y-3">
                    <p className="text-white text-sm">{proof.details}</p>
                    <div className="space-y-2 pt-2 border-t border-white/10">
                      {Object.entries(proof.metrics).map(([key, value]) => (
                        <div key={key} className="flex justify-between text-xs">
                          <span className="text-[#b4b4b4]">{key}:</span>
                          <span className="text-white">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
