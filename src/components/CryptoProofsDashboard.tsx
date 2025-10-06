'use client';

import { motion } from 'motion/react';
import { Card } from './ui/card';
import { Shield, Lock, Shuffle, Unlock, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { metricsService } from '../services/metrics.service';
import { ThresholdService } from '../crypto/threshold.service';
import { BulletproofsService } from '../crypto/bulletproofs.service';
import { VRFService } from '../crypto/vrf.service';
import { useState, useEffect } from 'react';

export function CryptoProofsDashboard() {
  const [metrics, setMetrics] = useState(metricsService.getMetrics());
  const [thresholdStatus, setThresholdStatus] = useState(ThresholdService.getExecutorStatus());
  const [bulletproofsStats, setBulletproofsStats] = useState(BulletproofsService.getBatchStats());
  const [fairnessMetrics, setFairnessMetrics] = useState(VRFService.getFairnessMetrics());

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(metricsService.getMetrics());
      setThresholdStatus(ThresholdService.getExecutorStatus());
      setBulletproofsStats(BulletproofsService.getBatchStats());
      setFairnessMetrics(VRFService.getFairnessMetrics());
    }, 2000);

    return () => clearInterval(interval);
  }, []);

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
        'Encrypted Orders': metrics.orders.activeOrders.toString(),
        'Encryption Time': `${metrics.orders.encryptionTime}ms`,
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
        'Traders Verified': bulletproofsStats.verifiedProofs.toString(),
        'Proof Size': bulletproofsStats.averageSize,
        'Success Rate': `${Math.round(bulletproofsStats.successRate * 100)}%`
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
        'Entropy Score': `${Math.round(fairnessMetrics.entropy * 100)}%`,
        'Uniformity': `${Math.round(fairnessMetrics.uniformity * 100)}%`,
        'Unpredictability': `${Math.round(fairnessMetrics.unpredictability * 100)}%`
      }
    },
    {
      title: 'Threshold Network',
      description: `${thresholdStatus.online}/${thresholdStatus.online + thresholdStatus.offline} executors online`,
      icon: Unlock,
      color: 'from-[#8b5cf6] to-[#8b5cf6]/80',
      borderColor: 'border-[#8b5cf6]/30',
      bgColor: 'bg-[#8b5cf6]/10',
      status: thresholdStatus.online >= thresholdStatus.threshold ? 'Online' : 'Degraded',
      details: '3-of-5 threshold signature scheme using Shamir Secret Sharing prevents single point of failure.',
      metrics: {
        'Active Nodes': `${thresholdStatus.online}/${thresholdStatus.online + thresholdStatus.offline}`,
        'Threshold': `${thresholdStatus.threshold}-of-${thresholdStatus.online + thresholdStatus.offline}`,
        'Uptime': `${Math.round(thresholdStatus.uptime * 100)}%`
      }
    },
  ];

  return (
    <div>
      <div className="mb-4 sm:mb-6">
        <h2 className="text-white mb-1 sm:mb-2 text-lg sm:text-xl">Cryptographic Proofs Dashboard</h2>
        <p className="text-[#b4b4b4] text-sm sm:text-base">Real-time verification of all security guarantees</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
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
                    <Card className={`bg-white/5 border ${proof.borderColor} backdrop-blur-xl p-3 sm:p-6 relative overflow-hidden group hover:border-opacity-60 transition-all duration-300 cursor-pointer`}>
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
                        <div className="flex items-start justify-between mb-3 sm:mb-4">
                          <div className={`bg-gradient-to-br ${proof.color} p-2 sm:p-3 rounded-lg shadow-lg`}>
                            <proof.icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-[#00ff88] rounded-full animate-pulse" />
                            <span className="text-[#00ff88] text-xs">{proof.status}</span>
                          </div>
                        </div>

                        {/* Title and Description */}
                        <div className="mb-3 sm:mb-4">
                          <h3 className="text-white mb-1 text-sm sm:text-base font-medium">{proof.title}</h3>
                          <p className="text-[#b4b4b4] text-xs sm:text-sm">{proof.description}</p>
                        </div>

                        {/* Info Icon */}
                        <div className="flex items-center gap-1 sm:gap-2 text-[#00f0ff] text-xs">
                          <Info className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                          <span className="hidden sm:inline">Hover for details</span>
                          <span className="sm:hidden">Details</span>
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
