interface SolanaProvider {
  isPhantom?: boolean
  publicKey?: { toString(): string }
  isConnected?: boolean
  connect: () => Promise<{ publicKey: { toString(): string } }>
  disconnect: () => Promise<void>
  on: (event: string, handler: (...args: any[]) => void) => void
}

interface BackpackProvider {
  publicKey?: { toString(): string };
  isConnected?: boolean;
  connect?: () => Promise<{ publicKey?: { toString(): string } }>;
  disconnect?: () => Promise<void>;
  on?: (event: string, handler: () => void) => void;
}

interface EthereumProvider {
  isMetaMask?: boolean;
  request?: (args: { method: string }) => Promise<string[]>;
}

interface Window {
  solana?: SolanaProvider;
  solflare?: unknown;
  backpack?: BackpackProvider;
  ethereum?: EthereumProvider;
}
