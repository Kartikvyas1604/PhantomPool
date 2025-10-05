'use client';

// This component functionality has been integrated into the main App
// Keeping for backwards compatibility

import { Card } from './ui/card';
import { Button } from './ui/button';

export function MatchingEngine({ orders, isMatching, setIsMatching }: any) {
  return (
    <Card className="bg-white/5 border border-[#00f0ff]/20 backdrop-blur-xl p-6">
      <p className="text-white">Matching engine integrated into main interface</p>
      <Button onClick={() => setIsMatching(true)} disabled={isMatching || orders.length < 2}>
        Match Orders
      </Button>
    </Card>
  );
}
