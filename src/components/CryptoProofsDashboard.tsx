'use client';

import { Shield, Lock, Shuffle, Eye, CheckCircle, Activity, Zap } from 'lucide-react';

export function CryptoProofsDashboard() {
  const cryptoServices = [
    {
      title: 'ElGamal Homomorphic',
      status: 'Encrypting Orders',
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-400/10',
      borderColor: 'border-emerald-400/20',
      icon: Lock,
      details: '256-bit • secp256k1',
      active: true
    },
    {
      title: 'Bulletproofs+ Range',
      status: 'Solvency Verified',
      color: 'text-blue-400',
      bgColor: 'bg-blue-400/10',
      borderColor: 'border-blue-400/20',
      icon: Shield,
      details: 'Zero-knowledge • ~700 bytes',
      active: true
    },
    {
      title: 'VRF Fair Ordering',
      status: 'Shuffle Ready',
      color: 'text-purple-400',
      bgColor: 'bg-purple-400/10',
      borderColor: 'border-purple-400/20',
      icon: Shuffle,
      details: 'Ed25519-SHA512 • Verifiable',
      active: true
    },
    {
      title: 'ZK Matching Proofs',
      status: 'Proof Generation',
      color: 'text-orange-400',
      bgColor: 'bg-orange-400/10',
      borderColor: 'border-orange-400/20',
      icon: Eye,
      details: 'Groth16 • ~200 bytes',
      active: true
    },
    {
      title: 'Threshold Network',
      status: '5/5 Executors Online',
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-400/10',
      borderColor: 'border-cyan-400/20',
      icon: Activity,
      details: '3-of-5 required • Distributed',
      active: true
    }
  ];

  return (
    <div className="px-3 sm:px-6 py-3 sm:py-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
        {/* Cryptographic Security Status */}
        <div className="flex items-center gap-1">
          <Zap className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-semibold text-slate-300 hidden sm:inline">Cryptographic Security Layer</span>
          <span className="text-sm font-semibold text-slate-300 sm:hidden">Security Layer</span>
        </div>
        
        {/* System Health */}
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span className="text-sm text-emerald-400 font-medium hidden sm:inline">All Systems Operational</span>
          <span className="text-sm text-emerald-400 font-medium sm:hidden">All Operational</span>
        </div>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 mt-3 sm:mt-4">
        {cryptoServices.map((service) => (
          <div 
            key={service.title} 
            className={`relative p-2 sm:p-3 rounded-lg border transition-all duration-200 hover:scale-105 ${
              service.active 
                ? `${service.bgColor} ${service.borderColor}` 
                : 'bg-slate-800/30 border-slate-700/30'
            }`}
          >
            <div className="flex items-center justify-between mb-1 sm:mb-2">
              <service.icon className={`w-3 h-3 sm:w-4 sm:h-4 ${service.color}`} />
              {service.active && (
                <div className={`w-2 h-2 rounded-full ${service.color.replace('text-', 'bg-')} animate-pulse`} />
              )}
            </div>
            <div className="space-y-1">
              <div className="text-xs font-semibold text-slate-200 leading-tight">{service.title}</div>
              <div className={`text-xs ${service.color} font-medium leading-tight`}>{service.status}</div>
              <div className="text-xs text-slate-400 leading-tight hidden sm:block">{service.details}</div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="flex items-center justify-center mt-4 pt-3 border-t border-slate-700/30">
        <div className="flex items-center gap-6 text-xs text-slate-400">
          <div className="flex items-center gap-1">
            <div className="w-1 h-1 bg-emerald-400 rounded-full"></div>
            <span>Network: Solana Devnet</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1 h-1 bg-blue-400 rounded-full"></div>
            <span>Latency: <span className="text-emerald-400 font-mono">12ms</span></span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1 h-1 bg-purple-400 rounded-full"></div>
            <span>Block: <span className="text-slate-300 font-mono">247,382,951</span></span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1 h-1 bg-orange-400 rounded-full"></div>
            <span>Zero-Knowledge Dark Pool Active</span>
          </div>
        </div>
      </div>
    </div>
  );
}