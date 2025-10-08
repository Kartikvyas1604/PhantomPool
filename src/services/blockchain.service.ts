import { 
  Connection, 
  PublicKey, 
  Keypair, 
  Transaction, 
  SystemProgram,
  LAMPORTS_PER_SOL 
} from '@solana/web3.js'
import { Program, AnchorProvider, BN, web3 } from '@coral-xyz/anchor'
import { PhantomPool } from '../types/phantom-pool'
import idl from '../types/phantom-pool.json'

export interface OnChainOrder {
  orderHash: string
  owner: PublicKey
  pool: PublicKey
  side: string
  encryptedAmount: number[]
  encryptedPrice: number[]
  solvencyProof: number[]
  status: string
  submittedAt: number
}

export interface OnChainPool {
  authority: PublicKey
  tokenPair: string
  elgamalPublicKey: number[]
  vrfPublicKey: number[]
  totalOrders: BN
  matchingRound: BN
  isMatchingActive: boolean
  createdAt: BN
}

export interface OnChainMatchingRound {
  pool: PublicKey
  roundId: BN
  vrfProof: number[]
  orderHashes: number[][]
  matches: Array<{
    buyOrderHash: number[]
    sellOrderHash: number[]
    amount: BN
  }>
  clearingPrice: BN
  matchingProof: number[]
  startedAt: BN
  completedAt: BN | null
  status: { inProgress: Record<string, never> } | { decryptionComplete: Record<string, never> } | { completed: Record<string, never> } | { failed: Record<string, never> }
}

export class BlockchainService {
  private static instance: BlockchainService
  private connection: Connection
  private program!: Program<PhantomPool>
  private provider: AnchorProvider | null = null
  private programId = new PublicKey("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS")

  // Helper function to convert Anchor accounts to our interfaces
  private convertAnchorOrderToOnChainOrder(anchorOrder: any): OnChainOrder {
    return {
      ...anchorOrder,
      orderHash: Buffer.from(anchorOrder.orderHash).toString('hex'),
      side: Object.keys(anchorOrder.side)[0] as 'BUY' | 'SELL',
      status: Object.keys(anchorOrder.status)[0] as 'pending' | 'matched' | 'cancelled',
      solvencyProof: Array.from(anchorOrder.solvencyProof),
      encryptedAmount: Array.from(anchorOrder.encryptedAmount),
      encryptedPrice: Array.from(anchorOrder.encryptedPrice)
    }
  }
  
  private constructor() {
    this.connection = new Connection(
      process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
      'confirmed'
    )
  }

  static getInstance(): BlockchainService {
    if (!this.instance) {
      this.instance = new BlockchainService()
    }
    return this.instance
  }

  async initialize(wallet?: any): Promise<void> {
    if (!wallet) {
      // Create a default wallet for read-only operations
      const { Keypair } = await import('@solana/web3.js')
      wallet = {
        publicKey: Keypair.generate().publicKey,
        signTransaction: () => { throw new Error('Read-only wallet cannot sign') },
        signAllTransactions: () => { throw new Error('Read-only wallet cannot sign') }
      }
    }

    this.provider = new AnchorProvider(
      this.connection,
      wallet,
      { commitment: 'confirmed' }
    )
    this.program = new Program(idl as PhantomPool, this.programId, this.provider)
    
    console.log('BlockchainService initialized')
  }

  async initializePool(
    tokenPair: string,
    elgamalPublicKey: Buffer,
    vrfPublicKey: Buffer,
    authority: Keypair
  ): Promise<string> {
    const [poolPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("pool"), Buffer.from(tokenPair)],
      this.programId
    )

    const tx = await this.program.methods
      .initializePool(
        tokenPair,
        Array.from(elgamalPublicKey),
        Array.from(vrfPublicKey)
      )
      .accounts({
        pool: poolPda,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc()

    return tx
  }

  async submitEncryptedOrder(
    poolAddress: PublicKey,
    encryptedAmount: Buffer,
    encryptedPrice: Buffer,
    side: 'buy' | 'sell',
    solvencyProof: Buffer,
    orderHash: Buffer,
    user: Keypair
  ): Promise<string> {
    const [orderPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("order"), orderHash],
      this.programId
    )

    const sideEnum = side === 'buy' ? { buy: {} } : { sell: {} }

    const tx = await this.program.methods
      .submitEncryptedOrder(
        Array.from(encryptedAmount),
        Array.from(encryptedPrice),
        sideEnum,
        Array.from(solvencyProof),
        Array.from(orderHash)
      )
      .accounts({
        order: orderPda,
        pool: poolAddress,
        user: user.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([user])
      .rpc()

    return tx
  }

  async startMatchingRound(
    poolAddress: PublicKey,
    roundId: number,
    vrfProof: Buffer,
    orderHashes: Buffer[],
    authority: Keypair
  ): Promise<string> {
    const [matchingRoundPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("round"),
        poolAddress.toBuffer(),
        Buffer.from(roundId.toString())
      ],
      this.programId
    )

    const tx = await this.program.methods
      .startMatchingRound(
        new BN(roundId),
        Buffer.from(vrfProof),
        orderHashes.map(hash => Array.from(Buffer.from(hash)))
      )
      .accounts({
        matchingRound: matchingRoundPda,
        pool: poolAddress,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc()

    return tx
  }

  async executeMatches(
    matchingRoundAddress: PublicKey,
    poolAddress: PublicKey,
    matches: Array<{
      buyOrderHash: Buffer
      sellOrderHash: Buffer
      amount: number
    }>,
    clearingPrice: number,
    matchingProof: Buffer,
    authority: Keypair
  ): Promise<string> {
    const formattedMatches = matches.map(match => ({
      buyOrderHash: Array.from(match.buyOrderHash),
      sellOrderHash: Array.from(match.sellOrderHash),
      amount: new BN(match.amount)
    }))

    const tx = await this.program.methods
      .executeMatches(
        formattedMatches,
        new BN(clearingPrice),
        Buffer.from(matchingProof)
      )
      .accounts({
        matchingRound: matchingRoundAddress,
        pool: poolAddress,
        authority: authority.publicKey,
      })
      .signers([authority])
      .rpc()

    return tx
  }

  async cancelOrder(
    orderHash: Buffer,
    user: Keypair
  ): Promise<string> {
    const [orderPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("order"), orderHash],
      this.programId
    )

    const tx = await this.program.methods
      .cancelOrder(Array.from(orderHash))
      .accounts({
        order: orderPda,
        user: user.publicKey,
      })
      .signers([user])
      .rpc()

    return tx
  }

  async registerExecutor(
    executorId: number,
    publicKey: Buffer,
    endpoint: string,
    authority: Keypair
  ): Promise<string> {
    const [executorPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("executor"), Buffer.from([executorId])],
      this.programId
    )

    // Executor registration not implemented in current smart contract
    console.log('Executor registration not implemented yet')
    return 'mock-tx-id'
  }

  async getPool(tokenPair: string): Promise<OnChainPool | null> {
    try {
      const [poolPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("pool"), Buffer.from(tokenPair)],
        this.programId
      )

      const poolAccount = await this.program.account.pool.fetch(poolPda)
      return poolAccount as OnChainPool
    } catch (error) {
      console.error('Failed to fetch pool:', error)
      return null
    }
  }

  async getOrder(orderHash: Buffer): Promise<OnChainOrder | null> {
    try {
      const [orderPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("order"), orderHash],
        this.programId
      )

      const orderAccount = await this.program.account.order.fetch(orderPda)
      return this.convertAnchorOrderToOnChainOrder(orderAccount)
    } catch (error) {
      console.error('Failed to fetch order:', error)
      return null
    }
  }

  async getMatchingRound(
    poolAddress: PublicKey,
    roundId: number
  ): Promise<OnChainMatchingRound | null> {
    try {
      const [matchingRoundPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("round"),
          poolAddress.toBuffer(),
          Buffer.from(roundId.toString())
        ],
        this.programId
      )

      const roundAccount = await this.program.account.matchingRound.fetch(matchingRoundPda)
      return {
        ...roundAccount,
        vrfProof: Array.from(roundAccount.vrfProof),
        orderHashes: roundAccount.orderHashes.map((hash: any) => Array.from(hash)),
        matchingProof: Array.from(roundAccount.matchingProof)
      } as OnChainMatchingRound
    } catch (error) {
      console.error('Failed to fetch matching round:', error)
      return null
    }
  }

  async getPendingOrders(poolAddress: PublicKey): Promise<OnChainOrder[]> {
    try {
      const orders = await this.program.account.order.all([
        {
          memcmp: {
            offset: 8 + 32,
            bytes: poolAddress.toBase58(),
          },
        },
      ])

      return orders
        .map(order => this.convertAnchorOrderToOnChainOrder(order.account))
        .filter(order => order.status === 'pending')
    } catch (error) {
      console.error('Failed to fetch pending orders:', error)
      return []
    }
  }

  async getUserOrders(userAddress: PublicKey): Promise<OnChainOrder[]> {
    try {
      const orders = await this.program.account.order.all([
        {
          memcmp: {
            offset: 8,
            bytes: userAddress.toBase58(),
          },
        },
      ])

      return orders.map(order => this.convertAnchorOrderToOnChainOrder(order.account))
    } catch (error) {
      console.error('Failed to fetch user orders:', error)
      return []
    }
  }

  async getExecutorNodes(): Promise<Array<{
    executorId: number
    owner: PublicKey
    publicKey: number[]
    endpoint: string
    isActive: boolean
    registeredAt: BN
    totalDecryptions: BN
  }>> {
    try {
      // Executor accounts not implemented in current smart contract
      console.log('Executor accounts not implemented yet')
      return []
    } catch (error) {
      console.error('Failed to fetch executors:', error)
      return []
    }
  }

  async subscribeToOrderEvents(callback: (event: any) => void): Promise<void> {
    // Only use events that exist in the IDL
    this.program.addEventListener('OrderSubmitted', callback)
  }

  async subscribeToMatchingEvents(callback: (event: any) => void): Promise<void> {
    // Only use events that exist in the IDL
    this.program.addEventListener('TradeExecuted', callback)
    this.program.addEventListener('TradeExecuted', callback)
  }

  async getRecentTransactions(address: PublicKey, limit: number = 50): Promise<any[]> {
    try {
      const signatures = await this.connection.getSignaturesForAddress(
        address,
        { limit }
      )

      const transactions = await Promise.all(
        signatures.map(async (sig) => {
          const tx = await this.connection.getTransaction(sig.signature, {
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0
          })
          return {
            signature: sig.signature,
            blockTime: sig.blockTime,
            transaction: tx,
            err: sig.err
          }
        })
      )

      return transactions.filter(tx => tx.transaction !== null)
    } catch (error) {
      console.error('Failed to fetch transactions:', error)
      return []
    }
  }

  async getAccountBalance(address: PublicKey): Promise<number> {
    try {
      const balance = await this.connection.getBalance(address)
      return balance / LAMPORTS_PER_SOL
    } catch (error) {
      console.error('Failed to get balance:', error)
      return 0
    }
  }

  async simulateTransaction(transaction: Transaction): Promise<any> {
    try {
      const result = await this.connection.simulateTransaction(transaction)
      return result
    } catch (error) {
      console.error('Transaction simulation failed:', error)
      throw error
    }
  }

  async confirmTransaction(signature: string): Promise<boolean> {
    try {
      const confirmation = await this.connection.confirmTransaction(signature, 'confirmed')
      return !confirmation.value.err
    } catch (error) {
      console.error('Transaction confirmation failed:', error)
      return false
    }
  }

  getConnection(): Connection {
    return this.connection
  }

  getProgramId(): PublicKey {
    return this.programId
  }

  async getPoolAddress(tokenPair: string): Promise<PublicKey> {
    const [poolPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("pool"), Buffer.from(tokenPair)],
      this.programId
    )
    return poolPda
  }

  async getOrderAddress(orderHash: Buffer): Promise<PublicKey> {
    const [orderPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("order"), orderHash],
      this.programId
    )
    return orderPda
  }
}