import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    // Simulate health check
    const uptime = Date.now() - (Math.random() * 86400000); // Random uptime up to 24 hours
    
    const health = {
      status: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
      timestamp: Date.now(),
      uptime,
      services: {
        redis: Math.random() > 0.1, // 90% chance of being healthy
        crypto: Math.random() > 0.05, // 95% chance of being healthy
        matching: Math.random() > 0.08, // 92% chance of being healthy
        api: true, // Always healthy since we're responding
        database: Math.random() > 0.07 // 93% chance of being healthy
      },
      activeConnections: Math.floor(Math.random() * 50) + 10,
      version: '1.0.0',
      environment: 'development'
    };

    // Determine overall status based on service health
    const healthyCount = Object.values(health.services).filter(Boolean).length;
    const totalCount = Object.values(health.services).length;
    
    if (healthyCount === totalCount) {
      health.status = 'healthy';
    } else if (healthyCount >= totalCount * 0.8) {
      health.status = 'degraded';
    } else {
      health.status = 'unhealthy';
    }

    return NextResponse.json(health);
  } catch (error) {
    return NextResponse.json(
      { 
        status: 'unhealthy',
        error: 'Internal server error',
        timestamp: Date.now()
      },
      { status: 500 }
    );
  }
}