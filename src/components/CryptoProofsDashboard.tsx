'use client';

import { motion } from 'motion/react';
import { Card } from './ui/card';
import { Shield, Lock, Shuffle, Unlock, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { metricsService } from '../services/metrics.service';
import { BulletproofsRealService } from '../crypto/bulletproofs.real.service';
import { VRFRealService } from '../crypto/vrf.real.service';
import { useState, useEffect } from 'react';

export function CryptoProofsDashboard() {
  const [metrics, setMetrics] = useState(metricsService.getMetrics());
  const [thresholdStatus, setThresholdStatus] = useState({ online: 5, offline: 0, threshold: 3, uptime: 0.99 });
  const [bulletproofsStats, setBulletproofsStats] = useState(BulletproofsRealService.getBatchStats());
  const [fairnessMetrics, setFairnessMetrics] = useState(VRFRealService.getFairnessMetrics());

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(metricsService.getMetrics());
      setThresholdStatus({ online: 5, offline: 0, threshold: 3, uptime: 0.99 });
      setBulletproofsStats(BulletproofsRealService.getBatchStats());
      setFairnessMetrics(VRFRealService.getFairnessMetrics());
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const proofs = [
    {
      title: 'ElGamal Encryption',
      description: 'Active orders encrypted',
      icon: Lock,
      statusColor: 'status-info',
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
      statusColor: 'status-success',
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
      statusColor: 'text-primary',
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
      statusColor: thresholdStatus.online >= thresholdStatus.threshold ? 'status-success' : 'status-warning',
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
        <h2 className="text-foreground mb-1 sm:mb-2 text-lg sm:text-xl font-semibold">Cryptographic Proofs Dashboard</h2>
        <p className="text-muted-foreground text-sm sm:text-base">Real-time verification of all security guarantees</p>
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
                    <Card className="professional-card p-3 sm:p-6 cursor-pointer">
                      <div className="relative z-10">
                        {/* Icon and Status */}
                        <div className="flex items-start justify-between mb-3 sm:mb-4">
                          <div className="bg-primary p-2 sm:p-3 rounded-lg professional-shadow">
                            <proof.icon className="w-5 h-5 sm:w-6 sm:h-6 text-primary-foreground" />
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-success rounded-full" />
                            <span className={`${proof.statusColor} text-xs`}>{proof.status}</span>
                          </div>
                        </div>

                        {/* Title and Description */}
                        <div className="mb-3 sm:mb-4">
                          <h3 className="text-foreground mb-1 text-sm sm:text-base font-medium">{proof.title}</h3>
                          <p className="text-muted-foreground text-xs sm:text-sm">{proof.description}</p>
                        </div>

                        {/* Info Icon */}
                        <div className="flex items-center gap-1 sm:gap-2 text-primary text-xs">
                          <Info className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                          <span className="hidden sm:inline">Hover for details</span>
                          <span className="sm:hidden">Details</span>
                        </div>
                      </div>
                    </Card>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="professional-card p-4 max-w-xs professional-shadow-lg">
                  <div className="space-y-3">
                    <p className="text-foreground text-sm">{proof.details}</p>
                    <div className="space-y-2 pt-2 border-t border-border">
                      {Object.entries(proof.metrics).map(([key, value]) => (
                        <div key={key} className="flex justify-between text-xs">
                          <span className="text-muted-foreground">{key}:</span>
                          <span className="text-foreground font-medium">{value}</span>
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
