interface SolanaProvider {
  isPhantom?: boolean
  publicKey?: { toString(): string }
  isConnected?: boolean
  connect: () => Promise<{ publicKey: { toString(): string } }>
  disconnect: () => Promise<void>
  on: (event: string, handler: (...args: any[]) => void) => void
}

interface Window {
  solana?: SolanaProvider
}
