export interface WebSocketMessage {
  type: string
  data: any
  timestamp: number
}

export interface LiveUpdate {
  orderBook: any
  matching: any
  execution: any
  prices: any
}

export class WebSocketRealService {
  private static instance: WebSocketRealService
  private connections: Set<WebSocket> = new Set()
  private isServerSide = typeof window === 'undefined'
  private updateInterval: NodeJS.Timeout | null = null
  private phantomPoolService: any = null

  static getInstance(): WebSocketRealService {
    if (!this.instance) {
      this.instance = new WebSocketRealService()
    }
    return this.instance
  }

  async initialize(phantomPoolService?: any): Promise<void> {
    if (phantomPoolService) {
      this.phantomPoolService = phantomPoolService
      this.setupEventListeners()
    }
    
    this.startLiveUpdates()
    console.log('WebSocket Real Service initialized')
  }

  private setupEventListeners(): void {
    if (!this.phantomPoolService) return

    this.phantomPoolService.on('orderSubmitted', (data: any) => {
      this.broadcast({
        type: 'ORDER_SUBMITTED',
        data: {
          orderHash: data.orderHash,
          side: data.order.side,
          tokenPair: data.order.tokenPair,
          timestamp: Date.now()
        },
        timestamp: Date.now()
      })
    })

    this.phantomPoolService.on('orderBookUpdated', (data: any) => {
      this.broadcast({
        type: 'ORDERBOOK_UPDATED',
        data,
        timestamp: Date.now()
      })
    })

    this.phantomPoolService.on('matchingStarted', (data: any) => {
      this.broadcast({
        type: 'MATCHING_STARTED',
        data: {
          roundNumber: data.roundNumber,
          timestamp: Date.now()
        },
        timestamp: Date.now()
      })
    })

    this.phantomPoolService.on('matchingCompleted', (data: any) => {
      this.broadcast({
        type: 'MATCHING_COMPLETED',
        data: {
          matches: data.matches,
          clearingPrice: data.clearingPrice,
          totalVolume: data.totalVolume,
          timestamp: Date.now()
        },
        timestamp: Date.now()
      })
    })

    this.phantomPoolService.on('tradesExecuted', (data: any) => {
      this.broadcast({
        type: 'TRADES_EXECUTED',
        data: {
          signature: data.signature,
          matches: data.matches.length,
          clearingPrice: data.clearingPrice,
          totalVolume: data.totalVolume,
          executionTime: data.executionTime,
          timestamp: Date.now()
        },
        timestamp: Date.now()
      })
    })
  }

  private startLiveUpdates(): void {
    if (this.updateInterval) return

    this.updateInterval = setInterval(async () => {
      try {
        const liveUpdate = await this.generateLiveUpdate()
        
        this.broadcast({
          type: 'LIVE_UPDATE',
          data: liveUpdate,
          timestamp: Date.now()
        })
        
      } catch (error) {
        console.error('Live update generation failed:', error)
      }
    }, 2000)
  }

  private async generateLiveUpdate(): Promise<LiveUpdate> {
    const orderBook = this.phantomPoolService 
      ? await this.phantomPoolService.getOrderBookState()
      : this.getMockOrderBook()

    const poolStats = this.phantomPoolService
      ? await this.phantomPoolService.getLivePoolStats()
      : this.getMockPoolStats()

    const currentPrice = this.phantomPoolService
      ? await this.phantomPoolService.getCurrentPrice('SOL/USDC')
      : 150 + (Math.random() - 0.5) * 2

    return {
      orderBook: {
        buyOrders: orderBook.buyOrders,
        sellOrders: orderBook.sellOrders,
        totalVolume: orderBook.totalVolume,
        spread: orderBook.spread,
        topBid: orderBook.topBid,
        topAsk: orderBook.topAsk,
        isMatching: orderBook.isMatching,
        nextMatchIn: orderBook.nextMatchIn
      },
      matching: {
        status: orderBook.isMatching ? 'active' : 'waiting',
        nextRound: orderBook.nextMatchIn,
        roundNumber: 0
      },
      execution: {
        avgTime: poolStats.avgExecutionTime,
        totalTrades: poolStats.totalTrades,
        networkHealth: poolStats.networkHealth
      },
      prices: {
        'SOL/USDC': currentPrice,
        timestamp: Date.now()
      }
    }
  }

  private getMockOrderBook() {
    return {
      buyOrders: Math.floor(Math.random() * 20) + 5,
      sellOrders: Math.floor(Math.random() * 20) + 5,
      totalVolume: (Math.random() * 100000 + 50000).toString(),
      spread: 0.5 + Math.random() * 1.5,
      topBid: 149.5 + Math.random() * 2,
      topAsk: 150.5 + Math.random() * 2,
      isMatching: Math.random() < 0.1,
      nextMatchIn: Math.floor(Math.random() * 30) + 1
    }
  }

  private getMockPoolStats() {
    return {
      totalOrders: Math.floor(Math.random() * 1000) + 100,
      totalTrades: Math.floor(Math.random() * 500) + 50,
      totalVolume: (Math.random() * 1000000 + 100000).toString(),
      activeTraders: Math.floor(Math.random() * 50) + 10,
      avgExecutionTime: 150 + Math.random() * 100,
      privacyScore: 0.95 + Math.random() * 0.04,
      networkHealth: 0.8 + Math.random() * 0.2
    }
  }

  private broadcast(message: WebSocketMessage): void {
    if (this.isServerSide) {
      console.log('Broadcasting WebSocket message:', message.type)
      return
    }

    const messageStr = JSON.stringify(message)
    
    this.connections.forEach(ws => {
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(messageStr)
        }
      } catch (error) {
        console.error('Failed to send WebSocket message:', error)
        this.connections.delete(ws)
      }
    })
  }

  addConnection(ws: WebSocket): void {
    this.connections.add(ws)
    
    ws.onclose = () => {
      this.connections.delete(ws)
    }
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      this.connections.delete(ws)
    }

    this.sendWelcomeMessage(ws)
  }

  private sendWelcomeMessage(ws: WebSocket): void {
    try {
      ws.send(JSON.stringify({
        type: 'WELCOME',
        data: {
          message: 'Connected to PhantomPool WebSocket',
          timestamp: Date.now()
        },
        timestamp: Date.now()
      }))
    } catch (error) {
      console.error('Failed to send welcome message:', error)
    }
  }

  getConnectionCount(): number {
    return this.connections.size
  }

  stop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval)
      this.updateInterval = null
    }

    this.connections.forEach(ws => {
      try {
        ws.close()
      } catch (error) {
        console.error('Error closing WebSocket:', error)
      }
    })
    
    this.connections.clear()
  }
}