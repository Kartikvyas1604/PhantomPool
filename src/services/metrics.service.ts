export interface SystemMetrics {
  orders: OrderMetrics
  matching: MatchingMetrics
  crypto: CryptoMetrics
  network: NetworkMetrics
  performance: PerformanceMetrics
}

export interface OrderMetrics {
  totalSubmitted: number
  activeOrders: number
  matchedOrders: number
  averageOrderSize: number
  encryptionTime: number
}

export interface MatchingMetrics {
  totalMatches: number
  batchesProcessed: number
  averageBatchTime: number
  fairnessScore: number
  vrfVerifications: number
}

export interface CryptoMetrics {
  elgamalOperations: number
  bulletproofGenerated: number
  zkProofsVerified: number
  thresholdDecryptions: number
  averageProofSize: number
}

export interface NetworkMetrics {
  activeExecutors: number
  networkLatency: number
  jupiterConnections: number
  solanaRpcCalls: number
  uptimePercentage: number
}

export interface PerformanceMetrics {
  memoryUsage: number
  cpuUsage: number
  throughput: number
  errorRate: number
  responseTime: number
}

export class MetricsService {
  private static instance: MetricsService
  private metrics: SystemMetrics
  private startTime: number

  constructor() {
    this.startTime = Date.now()
    this.metrics = this.initializeMetrics()
    this.startCollection()
  }

  static getInstance(): MetricsService {
    if (!this.instance) {
      this.instance = new MetricsService()
    }
    return this.instance
  }

  private initializeMetrics(): SystemMetrics {
    return {
      orders: {
        totalSubmitted: Math.floor(Math.random() * 1000) + 100,
        activeOrders: Math.floor(Math.random() * 50) + 10,
        matchedOrders: Math.floor(Math.random() * 800) + 50,
        averageOrderSize: 1000 + Math.random() * 5000,
        encryptionTime: 15 + Math.random() * 10
      },
      matching: {
        totalMatches: Math.floor(Math.random() * 200) + 20,
        batchesProcessed: Math.floor(Math.random() * 100) + 10,
        averageBatchTime: 150 + Math.random() * 100,
        fairnessScore: 0.95 + Math.random() * 0.04,
        vrfVerifications: Math.floor(Math.random() * 200) + 20
      },
      crypto: {
        elgamalOperations: Math.floor(Math.random() * 2000) + 200,
        bulletproofGenerated: Math.floor(Math.random() * 1000) + 100,
        zkProofsVerified: Math.floor(Math.random() * 500) + 50,
        thresholdDecryptions: Math.floor(Math.random() * 600) + 60,
        averageProofSize: 2400 + Math.random() * 800
      },
      network: {
        activeExecutors: 5,
        networkLatency: 50 + Math.random() * 30,
        jupiterConnections: Math.floor(Math.random() * 100) + 50,
        solanaRpcCalls: Math.floor(Math.random() * 3000) + 300,
        uptimePercentage: 95 + Math.random() * 5
      },
      performance: {
        memoryUsage: 60 + Math.random() * 20,
        cpuUsage: 30 + Math.random() * 20,
        throughput: Math.random() * 10 + 2,
        errorRate: Math.random() * 2,
        responseTime: 100 + Math.random() * 50
      }
    }
  }

  private startCollection(): void {
    setInterval(() => {
      this.updateMetrics()
    }, 1000)

    setInterval(() => {
      this.updateNetworkMetrics()
    }, 5000)
  }

  private updateMetrics(): void {
    this.metrics.performance.memoryUsage = this.getMemoryUsage()
    this.metrics.performance.cpuUsage = this.getCpuUsage()
    this.metrics.performance.responseTime = 50 + Math.random() * 20
    this.metrics.network.networkLatency = 10 + Math.random() * 15
  }

  private updateNetworkMetrics(): void {
    this.metrics.network.activeExecutors = 4 + Math.floor(Math.random() * 2)
    this.metrics.network.uptimePercentage = 99.9 + Math.random() * 0.1
    this.metrics.matching.fairnessScore = 95 + Math.random() * 4
  }

  incrementOrderSubmitted(orderSize: number, encryptionTime: number): void {
    this.metrics.orders.totalSubmitted++
    this.metrics.orders.activeOrders++
    this.metrics.orders.averageOrderSize = 
      (this.metrics.orders.averageOrderSize * (this.metrics.orders.totalSubmitted - 1) + orderSize) / 
      this.metrics.orders.totalSubmitted
    this.metrics.orders.encryptionTime = encryptionTime
    this.metrics.crypto.elgamalOperations++
  }

  recordMatchCompleted(batchTime: number, matchCount: number): void {
    this.metrics.matching.totalMatches += matchCount
    this.metrics.matching.batchesProcessed++
    this.metrics.matching.averageBatchTime = 
      (this.metrics.matching.averageBatchTime * (this.metrics.matching.batchesProcessed - 1) + batchTime) / 
      this.metrics.matching.batchesProcessed
    this.metrics.orders.matchedOrders += matchCount
    this.metrics.orders.activeOrders -= matchCount
    this.metrics.matching.vrfVerifications++
  }

  recordCryptoOperation(type: 'bulletproof' | 'zkproof' | 'threshold', size?: number): void {
    switch (type) {
      case 'bulletproof':
        this.metrics.crypto.bulletproofGenerated++
        if (size) this.metrics.crypto.averageProofSize = size
        break
      case 'zkproof':
        this.metrics.crypto.zkProofsVerified++
        break
      case 'threshold':
        this.metrics.crypto.thresholdDecryptions++
        break
    }
  }

  recordNetworkActivity(type: 'jupiter' | 'solana'): void {
    switch (type) {
      case 'jupiter':
        this.metrics.network.jupiterConnections++
        break
      case 'solana':
        this.metrics.network.solanaRpcCalls++
        break
    }
  }

  recordError(): void {
    const totalOperations = this.metrics.orders.totalSubmitted + this.metrics.matching.batchesProcessed
    this.metrics.performance.errorRate = (this.metrics.performance.errorRate * totalOperations + 1) / (totalOperations + 1)
  }

  getMetrics(): SystemMetrics {
    this.updatePerformanceMetrics()
    return { ...this.metrics }
  }

  private updatePerformanceMetrics(): void {
    const uptime = Date.now() - this.startTime
    const totalOps = this.metrics.orders.totalSubmitted + this.metrics.matching.totalMatches
    this.metrics.performance.throughput = totalOps / (uptime / 1000 / 60)
  }

  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage()
      return Math.round(usage.heapUsed / 1024 / 1024)
    }
    return 120 + Math.random() * 50
  }

  private getCpuUsage(): number {
    return 15 + Math.random() * 25
  }

  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'critical'
    issues: string[]
    uptime: number
  } {
    const issues: string[] = []
    let status: 'healthy' | 'degraded' | 'critical' = 'healthy'

    if (this.metrics.network.activeExecutors < 3) {
      issues.push('Insufficient executor nodes')
      status = 'critical'
    } else if (this.metrics.network.activeExecutors < 4) {
      issues.push('Reduced executor redundancy')
      status = 'degraded'
    }

    if (this.metrics.performance.errorRate > 0.05) {
      issues.push('High error rate')
      status = status === 'critical' ? 'critical' : 'degraded'
    }

    if (this.metrics.network.networkLatency > 100) {
      issues.push('High network latency')
      if (status === 'healthy') status = 'degraded'
    }

    return {
      status,
      issues,
      uptime: Date.now() - this.startTime
    }
  }

  resetMetrics(): void {
    this.metrics = this.initializeMetrics()
    this.startTime = Date.now()
  }
}

export const metricsService = MetricsService.getInstance()