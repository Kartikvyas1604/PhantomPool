export interface SolanaProvider {
  isPhantom?: boolean
  publicKey?: { toString(): string }
  isConnected?: boolean
  connect: () => Promise<{ publicKey: { toString(): string } }>
  disconnect: () => Promise<void>
  on: (event: string, handler: (...args: any[]) => void) => void
  signTransaction?: (transaction: any) => Promise<any>
  signAllTransactions?: (transactions: any[]) => Promise<any[]>
}

export interface WalletState {
  connected: boolean
  connecting: boolean
  publicKey: string | null
  balance: number
  provider: SolanaProvider | null
}

export interface TransactionResult {
  signature: string
  confirmed: boolean
  slot?: number
  error?: string
}

export class SolanaService {
  private static instance: SolanaService
  private walletState: WalletState = {
    connected: false,
    connecting: false,
    publicKey: null,
    balance: 0,
    provider: null
  }
  private listeners: Map<string, Function[]> = new Map()

  static getInstance(): SolanaService {
    if (!this.instance) {
      this.instance = new SolanaService()
    }
    return this.instance
  }

  async connectWallet(): Promise<WalletState> {
    if (typeof window === 'undefined') {
      throw new Error('Window not available')
    }

    this.walletState.connecting = true
    this.emit('connecting')

    try {
      const provider = (window as any).solana
      if (!provider) {
        throw new Error('Solana wallet not found')
      }

      const response = await provider.connect()
      this.walletState = {
        connected: true,
        connecting: false,
        publicKey: response.publicKey.toString(),
        balance: await this.getBalance(response.publicKey.toString()),
        provider
      }

      provider.on('accountChanged', (publicKey: any) => {
        if (publicKey) {
          this.walletState.publicKey = publicKey.toString()
          this.emit('accountChanged', publicKey.toString())
        } else {
          this.disconnect()
        }
      })

      this.emit('connected', this.walletState)
      return this.walletState
    } catch (error) {
      this.walletState.connecting = false
      this.emit('error', error)
      throw error
    }
  }

  async disconnect(): Promise<void> {
    if (this.walletState.provider) {
      await this.walletState.provider.disconnect()
    }
    
    this.walletState = {
      connected: false,
      connecting: false,
      publicKey: null,
      balance: 0,
      provider: null
    }
    
    this.emit('disconnected')
  }

  async getBalance(publicKey: string): Promise<number> {
    try {
      const balance = Math.random() * 1000 + 500
      return Math.floor(balance * 100) / 100
    } catch (error) {
      console.error('Failed to get balance:', error)
      return 0
    }
  }

  async submitOrder(orderData: any): Promise<TransactionResult> {
    if (!this.walletState.connected) {
      throw new Error('Wallet not connected')
    }

    try {
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const signature = this.generateTransactionSignature()
      
      return {
        signature,
        confirmed: true,
        slot: Math.floor(Math.random() * 1000000)
      }
    } catch (error) {
      return {
        signature: '',
        confirmed: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async getOrderHistory(publicKey: string): Promise<any[]> {
    const mockHistory = [
      {
        signature: this.generateTransactionSignature(),
        type: 'buy',
        amount: '100 SOL',
        price: '$149.50',
        timestamp: Date.now() - 3600000,
        status: 'confirmed'
      },
      {
        signature: this.generateTransactionSignature(),
        type: 'sell',
        amount: '50 SOL',
        price: '$150.20',
        timestamp: Date.now() - 7200000,
        status: 'confirmed'
      }
    ]
    
    return mockHistory
  }

  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(callback)
  }

  private emit(event: string, data?: any): void {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.forEach(callback => callback(data))
    }
  }

  private generateTransactionSignature(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let signature = ''
    for (let i = 0; i < 88; i++) {
      signature += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return signature
  }

  getWalletState(): WalletState {
    return { ...this.walletState }
  }

  isConnected(): boolean {
    return this.walletState.connected
  }
}