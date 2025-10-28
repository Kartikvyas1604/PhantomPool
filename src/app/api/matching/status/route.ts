import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const now = Date.now();
    const lastRoundTime = now - (now % 30000); // Last 30-second boundary
    const nextRoundIn = Math.ceil((lastRoundTime + 30000 - now) / 1000);

    const matchingStatus = {
      isMatching: nextRoundIn <= 5, // Matching in last 5 seconds of each round
      nextRoundIn,
      matchingInterval: 30,
      totalOrders: {
        buy: Math.floor(Math.random() * 20) + 1,
        sell: Math.floor(Math.random() * 18) + 1
      },
      lastRoundAt: lastRoundTime,
      averageMatchTime: Math.random() * 2 + 1, // 1-3 seconds
      totalMatched24h: Math.floor(Math.random() * 500) + 100,
      volumeMatched24h: Math.random() * 1000000 + 500000,
      status: 'active' as const,
      timestamp: now
    };

    return NextResponse.json(matchingStatus);
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to fetch matching status',
        timestamp: Date.now()
      },
      { status: 500 }
    );
  }
}