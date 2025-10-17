// Jupiter DEX Integration for Production Trading
// Implements real token swaps and liquidity access via Jupiter API

import { Connection, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
// Use global fetch (available in Node.js 18+) or install node-fetch types
const fetch = global.fetch || require('node-fetch');

interface JupiterQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpactPct: number;
  marketInfos: Array<{
    id: string;
    label: string;
    lpFee: { amount: string; pct: number };
    platformFee: { amount: string; pct: number };
  }>;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
  }>;
}

interface JupiterSwapTransaction {
  swapTransaction: string;
  lastValidBlockHeight: number;
}

interface SwapParams {
  inputMint: string;
  outputMint: string;
  amount: number;
  slippageBps: number;
  userPublicKey: string;
  prioritizationFeeLamports?: number;
}

interface SwapResult {
  signature: string;
  inputAmount: number;
  outputAmount: number;
  priceImpact: number;
  fees: {
    jupiter: number;
    platform: number;
    total: number;
  };
  route: string[];
  executionTime: number;
}

export class JupiterProductionService {
  private readonly JUPITER_API_URL = 'https://quote-api.jup.ag/v6';
  private readonly connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  /**
   * Get quote for token swap
   */
  async getQuote(params: {
    inputMint: string;
    outputMint: string;
    amount: number;
    slippageBps?: number;
  }): Promise<JupiterQuote> {
    const { inputMint, outputMint, amount, slippageBps = 50 } = params;
    
    console.log(`🔍 Getting Jupiter quote: ${amount} ${inputMint} → ${outputMint}`);

    const quoteUrl = new URL(`${this.JUPITER_API_URL}/quote`);
    quoteUrl.searchParams.set('inputMint', inputMint);
    quoteUrl.searchParams.set('outputMint', outputMint);
    quoteUrl.searchParams.set('amount', amount.toString());
    quoteUrl.searchParams.set('slippageBps', slippageBps.toString());
    quoteUrl.searchParams.set('onlyDirectRoutes', 'false');
    quoteUrl.searchParams.set('asLegacyTransaction', 'false');

    try {
      const response = await fetch(quoteUrl.toString());
      
      if (!response.ok) {
        throw new Error(`Jupiter API error: ${response.status} ${response.statusText}`);
      }

      const quote = await response.json() as JupiterQuote;
      
      console.log(`💰 Quote received: ${quote.outAmount} output (${quote.priceImpactPct}% impact)`);
      console.log(`🛣️  Route: ${quote.routePlan.length} hops via ${quote.routePlan.map(r => r.swapInfo.label).join(' → ')}`);

      return quote;

    } catch (error) {
      console.error('❌ Failed to get Jupiter quote:', error);
      throw error;
    }
  }

  /**
   * Execute token swap
   */
  async executeSwap(params: SwapParams): Promise<SwapResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🚀 Executing swap: ${params.amount} tokens`);

      // Step 1: Get quote
      const quote = await this.getQuote({
        inputMint: params.inputMint,
        outputMint: params.outputMint,
        amount: params.amount,
        slippageBps: params.slippageBps,
      });

      // Step 2: Get swap transaction
      const swapTransaction = await this.getSwapTransaction(quote, params.userPublicKey);

      // Step 3: Execute transaction
      const signature = await this.sendTransaction(swapTransaction.swapTransaction);

      // Step 4: Wait for confirmation
      await this.confirmTransaction(signature);

      const executionTime = Date.now() - startTime;

      const result: SwapResult = {
        signature,
        inputAmount: parseInt(quote.inAmount),
        outputAmount: parseInt(quote.outAmount),
        priceImpact: quote.priceImpactPct,
        fees: this.calculateFees(quote),
        route: quote.routePlan.map(r => r.swapInfo.label),
        executionTime,
      };

      console.log(`✅ Swap completed in ${executionTime}ms`);
      console.log(`   Signature: ${signature}`);
      console.log(`   Output: ${result.outputAmount} tokens`);

      return result;

    } catch (error) {
      console.error('❌ Swap execution failed:', error);
      throw error;
    }
  }

  /**
   * Get swap transaction from Jupiter
   */
  private async getSwapTransaction(
    quote: JupiterQuote,
    userPublicKey: string
  ): Promise<JupiterSwapTransaction> {
    const swapUrl = `${this.JUPITER_API_URL}/swap`;

    const swapRequest = {
      quoteResponse: quote,
      userPublicKey,
      wrapAndUnwrapSol: true,
      useSharedAccounts: true,
      feeAccount: null,
      trackingAccount: null,
      computeUnitPriceMicroLamports: 'auto',
      prioritizationFeeLamports: 'auto',
      asLegacyTransaction: false,
    };

    try {
      const response = await fetch(swapUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(swapRequest),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Jupiter swap API error: ${response.status} - ${errorText}`);
      }

      return await response.json() as JupiterSwapTransaction;

    } catch (error) {
      console.error('❌ Failed to get swap transaction:', error);
      throw error;
    }
  }

  /**
   * Send transaction to Solana network
   */
  private async sendTransaction(serializedTransaction: string): Promise<string> {
    try {
      // Deserialize the transaction
      const transactionBuf = Buffer.from(serializedTransaction, 'base64');
      const transaction = VersionedTransaction.deserialize(transactionBuf);

      // Send transaction
      const signature = await this.connection.sendTransaction(transaction);

      console.log(`📡 Transaction sent: ${signature}`);
      return signature;

    } catch (error) {
      console.error('❌ Failed to send transaction:', error);
      throw error;
    }
  }

  /**
   * Confirm transaction on chain
   */
  private async confirmTransaction(signature: string): Promise<void> {
    try {
      console.log(`⏳ Confirming transaction: ${signature}`);
      
      const confirmation = await this.connection.confirmTransaction(signature, 'confirmed');
      
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      console.log(`✅ Transaction confirmed: ${signature}`);

    } catch (error) {
      console.error('❌ Transaction confirmation failed:', error);
      throw error;
    }
  }

  /**
   * Calculate total fees from quote
   */
  private calculateFees(quote: JupiterQuote): {
    jupiter: number;
    platform: number;
    total: number;
  } {
    let jupiterFees = 0;
    let platformFees = 0;

    quote.marketInfos.forEach(market => {
      jupiterFees += parseInt(market.lpFee.amount);
      platformFees += parseInt(market.platformFee.amount);
    });

    return {
      jupiter: jupiterFees,
      platform: platformFees,
      total: jupiterFees + platformFees,
    };
  }

  /**
   * Get supported tokens list
   */
  async getSupportedTokens(): Promise<Array<{
    address: string;
    chainId: number;
    decimals: number;
    name: string;
    symbol: string;
    logoURI?: string;
    tags: string[];
  }>> {
    try {
      const response = await fetch(`${this.JUPITER_API_URL}/tokens`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch tokens: ${response.status}`);
      }

      return await response.json();

    } catch (error) {
      console.error('❌ Failed to get supported tokens:', error);
      throw error;
    }
  }

  /**
   * Get token price in USDC
   */
  async getTokenPrice(tokenMint: string): Promise<number> {
    try {
      const response = await fetch(`${this.JUPITER_API_URL}/price?ids=${tokenMint}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch price: ${response.status}`);
      }

      const priceData = await response.json();
      return priceData.data[tokenMint]?.price || 0;

    } catch (error) {
      console.error('❌ Failed to get token price:', error);
      return 0;
    }
  }

  /**
   * Execute batch swaps for dark pool trades
   */
  async executeBatchSwaps(swaps: Array<{
    inputMint: string;
    outputMint: string;
    amount: number;
    userPublicKey: string;
  }>): Promise<SwapResult[]> {
    console.log(`🔄 Executing ${swaps.length} batch swaps...`);

    const results: SwapResult[] = [];
    
    // Execute swaps sequentially to avoid nonce conflicts
    for (const swap of swaps) {
      try {
        const result = await this.executeSwap({
          ...swap,
          slippageBps: 100, // 1% slippage for batch swaps
        });
        
        results.push(result);
        
        // Small delay between swaps
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.error(`❌ Batch swap failed for ${swap.userPublicKey}:`, error);
        // Continue with other swaps
      }
    }

    console.log(`✅ Batch swaps completed: ${results.length}/${swaps.length} successful`);
    return results;
  }

  /**
   * Get liquidity pools for token pair
   */
  async getLiquidityPools(inputMint: string, outputMint: string): Promise<Array<{
    id: string;
    label: string;
    liquidity: number;
    volume24h: number;
    fee: number;
  }>> {
    try {
      // Get quote to see available routes
      const quote = await this.getQuote({
        inputMint,
        outputMint,
        amount: 1000000, // 1 token for discovery
      });

      return quote.marketInfos.map(market => ({
        id: market.id,
        label: market.label,
        liquidity: 0, // Would need additional API call
        volume24h: 0, // Would need additional API call  
        fee: market.lpFee.pct,
      }));

    } catch (error) {
      console.error('❌ Failed to get liquidity pools:', error);
      return [];
    }
  }

  /**
   * Check if token pair has sufficient liquidity
   */
  async checkLiquidity(
    inputMint: string,
    outputMint: string,
    amount: number
  ): Promise<{
    hasLiquidity: boolean;
    priceImpact: number;
    availableRoutes: number;
  }> {
    try {
      const quote = await this.getQuote({
        inputMint,
        outputMint,
        amount,
      });

      return {
        hasLiquidity: quote.routePlan.length > 0,
        priceImpact: quote.priceImpactPct,
        availableRoutes: quote.routePlan.length,
      };

    } catch (error) {
      console.error('❌ Liquidity check failed:', error);
      return {
        hasLiquidity: false,
        priceImpact: 100,
        availableRoutes: 0,
      };
    }
  }

  /**
   * Common token mint addresses for Solana
   */
  static readonly TOKENS = {
    SOL: 'So11111111111111111111111111111111111111112',
    USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    WIF: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
    JUP: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
    RAY: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
  } as const;
}