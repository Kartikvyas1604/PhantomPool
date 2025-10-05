'use client';

import { motion } from 'motion/react';
import { TrendingUp, DollarSign, Shield, Users } from 'lucide-react';
import { Card } from './ui/card';

export function StatsCards() {
  const stats = [
    {
      icon: DollarSign,
      label: 'Monthly Volume',
      value: '$2.4B',
      change: '+23%',
      changePositive: true,
      color: 'from-[#00ff88] to-[#00ff88]/80',
      borderColor: 'border-[#00ff88]/30',
    },
    {
      icon: Users,
      label: 'Active Traders',
      value: '1,247',
      change: '+12%',
      changePositive: true,
      color: 'from-[#00f0ff] to-[#00f0ff]/80',
      borderColor: 'border-[#00f0ff]/30',
    },
    {
      icon: Shield,
      label: 'ZK Proofs Generated',
      value: '45.2K',
      change: '+34%',
      changePositive: true,
      color: 'from-[#ff00e5] to-[#ff00e5]/80',
      borderColor: 'border-[#ff00e5]/30',
    },
    {
      icon: TrendingUp,
      label: 'Avg Slippage',
      value: '0.04%',
      change: '-15%',
      changePositive: true,
      color: 'from-[#8b5cf6] to-[#8b5cf6]/80',
      borderColor: 'border-[#8b5cf6]/30',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          <Card className={`bg-white/5 border ${stat.borderColor} backdrop-blur-xl p-6 relative overflow-hidden group hover:border-opacity-60 transition-all duration-300`}>
            {/* Glow effect */}
            <div className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
            
            <div className="relative z-10">
              <div className="flex items-start justify-between mb-4">
                <div className={`bg-gradient-to-br ${stat.color} p-3 rounded-lg shadow-lg`}>
                  <stat.icon className="w-5 h-5 text-white" />
                </div>
                <span className={`text-sm ${stat.changePositive ? 'text-[#00ff88]' : 'text-[#ff00e5]'}`}>
                  {stat.change}
                </span>
              </div>
              <p className="text-[#b4b4b4] text-sm mb-1">{stat.label}</p>
              <p className="text-white text-xl">{stat.value}</p>
            </div>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
