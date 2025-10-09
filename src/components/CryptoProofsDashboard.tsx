'use client';

import { Shield, Lock, Shuffle, Eye } from 'lucide-react';

export function CryptoProofsDashboard() {
  const proofs = [
    {
      title: 'ElGamal',
      status: 'Active',
      color: 'text-blue-400',
      icon: Lock,
      count: 0
    },
    {
      title: 'Bulletproofs',
      status: 'Verified',
      color: 'text-emerald-400',
      icon: Shield,
      count: 0
    },
    {
      title: 'VRF Shuffle',
      status: 'Ready',
      color: 'text-purple-400',
      icon: Shuffle,
      count: 0
    },
    {
      title: 'ZK Proofs',
      status: 'Online',
      color: 'text-cyan-400',
      icon: Eye,
      count: 5
    }
  ];

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-6">
        <span className="text-xs text-slate-500">Security Status:</span>
        {proofs.map((proof) => (
          <div key={proof.title} className="flex items-center gap-2">
            <proof.icon className={`w-3 h-3 ${proof.color}`} />
            <span className="text-xs text-slate-300">{proof.title}</span>
            <div className={`w-2 h-2 rounded-full ${proof.color.replace('text-', 'bg-')}`} />
            <span className={`text-xs ${proof.color}`}>{proof.status}</span>
          </div>
        ))}
      </div>
      
      <div className="flex items-center gap-4 text-xs text-slate-400">
        <div>
          <span>Network: </span>
          <span className="text-slate-300">Solana Devnet</span>
        </div>
        <div>
          <span>Latency: </span>
          <span className="text-emerald-400">12ms</span>
        </div>
        <div>
          <span>Block: </span>
          <span className="text-slate-300 font-mono">247,382,951</span>
        </div>
      </div>
    </div>
  );
}