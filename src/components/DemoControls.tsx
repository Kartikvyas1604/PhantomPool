'use client';

import { motion, AnimatePresence } from 'motion/react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Users, Zap, RotateCcw, AlertTriangle } from 'lucide-react';
import { Badge } from './ui/badge';

interface DemoControlsProps {
  onSimulateTraders: () => void;
  onMatchOrders: () => void;
  onReset: () => void;
  demoStatus: string | null;
  ordersCount: number;
}

export function DemoControls({
  onSimulateTraders,
  onMatchOrders,
  onReset,
  demoStatus,
  ordersCount,
}: DemoControlsProps) {
  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.5 }}
      className="fixed bottom-6 right-6 z-50"
    >
      <Card className="bg-[#1a0b2e]/95 border border-[#00f0ff]/30 backdrop-blur-xl p-6 shadow-2xl shadow-[#00f0ff]/20 w-80">
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-white">Demo Controls</h3>
            <Badge variant="outline" className="border-[#00f0ff]/50 text-[#00f0ff] bg-[#00f0ff]/10">
              {ordersCount} Orders
            </Badge>
          </div>
          <p className="text-[#b4b4b4] text-sm">Control the trading simulation</p>
        </div>

        {/* Status Message */}
        <AnimatePresence>
          {demoStatus && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 bg-[#00ff88]/10 border border-[#00ff88]/30 rounded-lg p-3"
            >
              <p className="text-[#00ff88] text-sm">{demoStatus}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-3">
          {/* Simulate Traders */}
          <Button
            onClick={onSimulateTraders}
            className="w-full bg-gradient-to-r from-[#00f0ff] to-[#00f0ff]/80 hover:from-[#00f0ff]/90 hover:to-[#00f0ff]/70 text-white border-0 shadow-lg shadow-[#00f0ff]/20"
          >
            <Users className="w-4 h-4 mr-2" />
            Simulate 5 Traders
          </Button>

          {/* Match Orders */}
          <Button
            onClick={onMatchOrders}
            disabled={ordersCount < 2}
            className="w-full bg-gradient-to-r from-[#ff00e5] to-[#ff00e5]/80 hover:from-[#ff00e5]/90 hover:to-[#ff00e5]/70 text-white border-0 shadow-lg shadow-[#ff00e5]/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Zap className="w-4 h-4 mr-2" />
            Auto-Match Orders
          </Button>

          {/* MEV Bot Attack Simulation */}
          <Button
            variant="outline"
            className="w-full border-[#ffaa00]/50 text-[#ffaa00] hover:bg-[#ffaa00]/10"
            onClick={() => {
              // Show MEV attack denied animation
              const event = new CustomEvent('mev-attack-demo');
              window.dispatchEvent(event);
            }}
          >
            <AlertTriangle className="w-4 h-4 mr-2" />
            Test MEV Attack
          </Button>

          {/* Reset */}
          <Button
            onClick={onReset}
            variant="outline"
            className="w-full border-white/20 text-[#b4b4b4] hover:bg-white/5 hover:text-white"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset Demo
          </Button>
        </div>

        {/* Instructions */}
        <div className="mt-4 pt-4 border-t border-white/10">
          <p className="text-[#b4b4b4]/70 text-xs leading-relaxed">
            1. Simulate traders to add encrypted orders<br />
            2. Watch VRF shuffle for fairness<br />
            3. Match orders at fair clearing price<br />
            4. Execute via Jupiter with ZK proofs
          </p>
        </div>
      </Card>

      {/* MEV Attack Overlay */}
      <MEVAttackOverlay />
    </motion.div>
  );
}

// MEV Attack Demo Overlay Component
function MEVAttackOverlay() {
  const [showAttack, setShowAttack] = React.useState(false);

  React.useEffect(() => {
    const handleAttack = () => {
      setShowAttack(true);
      setTimeout(() => setShowAttack(false), 3000);
    };

    window.addEventListener('mev-attack-demo', handleAttack);
    return () => window.removeEventListener('mev-attack-demo', handleAttack);
  }, []);

  return (
    <AnimatePresence>
      {showAttack && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
        >
          <motion.div
            initial={{ y: 20 }}
            animate={{ y: 0 }}
            className="bg-red-500/20 border-2 border-red-500 rounded-2xl p-8 max-w-md backdrop-blur-xl"
          >
            <div className="text-center">
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 0.5, repeat: 3 }}
                className="inline-block mb-4"
              >
                <AlertTriangle className="w-16 h-16 text-red-500" />
              </motion.div>
              <h3 className="text-white text-xl mb-2">Access Denied!</h3>
              <p className="text-red-300 mb-4">
                MEV bot attempted to read encrypted orders
              </p>
              <div className="bg-black/50 rounded-lg p-4 font-mono text-sm">
                <p className="text-red-400">ERROR: Orders are homomorphically encrypted</p>
                <p className="text-red-400">Cannot extract order details</p>
                <p className="text-[#00ff88] mt-2">✓ Privacy protected by ElGamal encryption</p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Add React import for useState
import React from 'react';
