/**
 * Executor Coordinator Service
 * Manages the 5-executor threshold decryption network
 * Coordinates partial decryptions and transaction signing
 */

import { ExecutorNodeService } from './executor-node.service';
import { JupiterProductionService } from './jupiter.production.service';
import { ThresholdProductionService } from '../crypto/threshold.production.service';
const BN = require('bn.js');
type BNInstance = InstanceType<typeof BN>;
import { randomBytes } from 'crypto';

interface ExecutorEndpoint {
  id: number;
  url: string;
  nodeService?: ExecutorNodeService;
  status: 'online' | 'offline' | 'degraded';
  lastResponse: number;
  errorCount: number;
  totalRequests: number;
}

interface CoordinationRequest {
  type: 'decrypt' | 'sign';
  data: any;
  requiredExecutors: number;
  timeout: number;
}

interface CoordinationResult {
  success: boolean;
  responses: any[];
  failedExecutors: number[];
  executionTime: number;
}

interface ExecutionRequest {
  matchedPairs: Array<{
    buyOrder: any;
    sellOrder: any;
    amount: number;
    price: number;
  }>;
  clearingPrice: number;
  proof: any;
  timestamp: number;
}

export class ExecutorCoordinatorService {
  private executors: ExecutorEndpoint[] = [];
  private threshold: ThresholdProductionService;
  private jupiter?: JupiterProductionService;
  private coordinationStats = {
    totalRequests: 0,
    successfulRequests: 0,
    averageResponseTime: 0,
  };

  constructor(jupiterService?: JupiterProductionService) {
    this.threshold = new ThresholdProductionService();
    this.jupiter = jupiterService;
    this.initializeExecutors();
  }

  /**
   * Initialize 5 executor endpoints
   * In production: these would be separate services
   */
  private initializeExecutors(): void {
    // Generate secret shares for 3-of-5 threshold
    const masterKey = new BN(randomBytes(32));
    const shares = this.threshold.prepareThresholdShares(masterKey, 3, 5);

    for (let i = 1; i <= 5; i++) {
      const executorPrivateKey = randomBytes(32);
      
      // Create local executor node service for development
      const nodeService = new ExecutorNodeService({
        executorId: i,
        secretShare: shares[i - 1].share,
        port: 4000 + i,
        executorPrivateKey,
      });

      this.executors.push({
        id: i,
        url: `http://localhost:${4000 + i}`,
        nodeService,
        status: 'online',
        lastResponse: Date.now(),
        errorCount: 0,
        totalRequests: 0,
      });
    }

    console.log('✅ Initialized 5-executor threshold network (3-of-5)');
  }

  /**
   * Execute matched trades using threshold network
   * Main coordination function for trade execution
   */
  async executeMatchedTrades(request: ExecutionRequest): Promise<CoordinationResult> {
    const startTime = Date.now();
    console.log(`\n🚀 Coordinating execution of ${request.matchedPairs.length} matched trades...`);

    try {
      // Step 1: Build execution transactions
      const transactions = await this.buildExecutionTransactions(request);
      console.log(`✅ Built ${transactions.length} execution transactions`);

      // Step 2: Get signatures from 3-of-5 executors
      const signatureResult = await this.coordinateTransactionSigning(
        transactions,
        request.proof
      );

      if (!signatureResult.success) {
        throw new Error(`Failed to get required signatures: ${signatureResult.responses.length}/3`);
      }

      console.log(`✅ Collected ${signatureResult.responses.length} executor signatures`);

      // Step 3: Submit transactions to blockchain
      const submissionResult = await this.submitTransactions(
        transactions,
        signatureResult.responses
      );

      const executionTime = Date.now() - startTime;
      
      this.updateCoordinationStats(true, executionTime);

      console.log(`✅ Trade execution completed in ${executionTime}ms\n`);

      return {
        success: true,
        responses: submissionResult,
        failedExecutors: signatureResult.failedExecutors,
        executionTime,
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.updateCoordinationStats(false, executionTime);

      console.error(`❌ Trade execution failed after ${executionTime}ms:`, error);
      
      return {
        success: false,
        responses: [],
        failedExecutors: this.executors.map(e => e.id),
        executionTime,
      };
    }
  }

  /**
   * Coordinate threshold decryption across executors
   * Used by matching engine to decrypt aggregated volumes
   */
  async coordinateThresholdDecryption(
    ciphertexts: Array<{ C1: any; C2: any }>,
    requiredExecutors: number = 3
  ): Promise<CoordinationResult> {
    const startTime = Date.now();
    
    console.log(`🔐 Coordinating threshold decryption with ${this.executors.length} executors...`);

    const results: CoordinationResult[] = [];

    // Process each ciphertext
    for (let i = 0; i < ciphertexts.length; i++) {
      const ciphertext = ciphertexts[i];
      
      const decryptionResult = await this.requestPartialDecryptions({
        type: 'decrypt',
        data: { ciphertext, requestId: `decrypt_${i}_${Date.now()}` },
        requiredExecutors,
        timeout: 10000, // 10 seconds
      });

      results.push(decryptionResult);
    }

    // Combine all partial decryptions
    const combinedResults = this.combineDecryptionResults(results);

    const executionTime = Date.now() - startTime;
    console.log(`✅ Threshold decryption completed in ${executionTime}ms`);

    return {
      success: combinedResults.success,
      responses: combinedResults.responses,
      failedExecutors: combinedResults.failedExecutors,
      executionTime,
    };
  }

  /**
   * Get health status of all executors
   */
  async getExecutorHealth(): Promise<Array<{
    id: number;
    status: string;
    uptime: number;
    totalDecryptions: number;
    totalSignatures: number;
    errorRate: number;
  }>> {
    const healthChecks = await Promise.all(
      this.executors.map(async (executor) => {
        try {
          if (executor.nodeService) {
            const health = executor.nodeService.getHealth();
            return {
              id: executor.id,
              status: health.status,
              uptime: health.uptime,
              totalDecryptions: health.totalDecryptions,
              totalSignatures: health.totalSignatures,
              errorRate: health.errorRate,
            };
          } else {
            // For remote executors, make HTTP request
            return {
              id: executor.id,
              status: executor.status,
              uptime: Math.floor((Date.now() - executor.lastResponse) / 1000),
              totalDecryptions: 0,
              totalSignatures: 0,
              errorRate: executor.errorCount / Math.max(1, executor.totalRequests),
            };
          }
        } catch (error) {
          return {
            id: executor.id,
            status: 'offline',
            uptime: 0,
            totalDecryptions: 0,
            totalSignatures: 0,
            errorRate: 1.0,
          };
        }
      })
    );

    return healthChecks;
  }

  /**
   * Request partial decryptions from executors
   */
  private async requestPartialDecryptions(request: CoordinationRequest): Promise<CoordinationResult> {
    const responses: any[] = [];
    const failedExecutors: number[] = [];
    const startTime = Date.now();

    // Send requests to all executors in parallel
    const promises = this.executors.map(async (executor) => {
      try {
        executor.totalRequests++;
        
        if (executor.nodeService) {
          // Local executor
          const response = await Promise.race([
            executor.nodeService.partialDecrypt({
              ciphertext: request.data.ciphertext,
              requestId: request.data.requestId,
              timestamp: Date.now(),
            }),
            this.createTimeoutPromise(request.timeout),
          ]);

          if (response && 'executorId' in response) {
            responses.push(response);
            executor.lastResponse = Date.now();
            executor.status = 'online';
          } else {
            throw new Error('Timeout or invalid response');
          }
        } else {
          // Remote executor - make HTTP request
          const response = await this.makeHttpRequest(
            executor.url + '/decrypt',
            request.data,
            request.timeout
          );
          
          responses.push(response);
          executor.lastResponse = Date.now();
          executor.status = 'online';
        }

      } catch (error) {
        console.warn(`❌ Executor ${executor.id} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        executor.errorCount++;
        executor.status = 'degraded';
        failedExecutors.push(executor.id);
      }
    });

    // Wait for all requests to complete
    await Promise.allSettled(promises);

    const success = responses.length >= request.requiredExecutors;
    const executionTime = Date.now() - startTime;

    console.log(`${success ? '✅' : '❌'} Partial decryptions: ${responses.length}/${request.requiredExecutors} required, ${failedExecutors.length} failed`);

    return {
      success,
      responses: responses.slice(0, request.requiredExecutors), // Take only required amount
      failedExecutors,
      executionTime,
    };
  }

  /**
   * Coordinate transaction signing across executors
   */
  private async coordinateTransactionSigning(
    transactions: string[],
    proof: any
  ): Promise<CoordinationResult> {
    const request: CoordinationRequest = {
      type: 'sign',
      data: { transactions, proof, requestId: `sign_${Date.now()}` },
      requiredExecutors: 3,
      timeout: 15000, // 15 seconds
    };

    const responses: any[] = [];
    const failedExecutors: number[] = [];
    const startTime = Date.now();

    // Send signing requests to all executors
    const promises = this.executors.map(async (executor) => {
      try {
        executor.totalRequests++;

        if (executor.nodeService) {
          const response = await Promise.race([
            executor.nodeService.signExecution({
              transaction: transactions[0], // Simplified - in production handle multiple
              matchProof: proof,
              requestId: request.data.requestId,
            }),
            this.createTimeoutPromise(request.timeout),
          ]);

          if (response && 'signature' in response) {
            responses.push(response);
            executor.lastResponse = Date.now();
          } else {
            throw new Error('Invalid signature response');
          }
        }

      } catch (error) {
        console.warn(`❌ Executor ${executor.id} signing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        executor.errorCount++;
        failedExecutors.push(executor.id);
      }
    });

    await Promise.allSettled(promises);

    const success = responses.length >= request.requiredExecutors;
    const executionTime = Date.now() - startTime;

    return {
      success,
      responses,
      failedExecutors,
      executionTime,
    };
  }

  /**
   * Build execution transactions using Jupiter
   */
  private async buildExecutionTransactions(request: ExecutionRequest): Promise<string[]> {
    const transactions: string[] = [];

    for (const pair of request.matchedPairs) {
      try {
        if (this.jupiter) {
          // Use Jupiter for optimal routing
          const quote = await this.jupiter.getQuote({
            inputMint: 'So11111111111111111111111111111111111111112', // SOL
            outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
            amount: Math.floor(pair.amount * 1e9), // Convert to lamports
            slippageBps: 50, // 0.5% slippage
          });

          const transaction = await this.jupiter.buildSwapTransaction(quote, {
            userPublicKey: pair.buyOrder.walletAddress,
          });

          transactions.push(transaction.serialize().toString('base64'));
        } else {
          // Fallback: create basic transaction
          const mockTransaction = Buffer.from(
            JSON.stringify({
              buyOrder: pair.buyOrder.orderHash,
              sellOrder: pair.sellOrder.orderHash,
              amount: pair.amount,
              price: pair.price,
            })
          ).toString('base64');

          transactions.push(mockTransaction);
        }

      } catch (error) {
        console.warn(`⚠️ Failed to build transaction for pair ${pair.buyOrder.orderHash}:${pair.sellOrder.orderHash}`);
      }
    }

    return transactions;
  }

  /**
   * Submit transactions to blockchain
   */
  private async submitTransactions(
    transactions: string[],
    signatures: any[]
  ): Promise<string[]> {
    const txSignatures: string[] = [];

    for (let i = 0; i < transactions.length; i++) {
      try {
        // In production: submit to Solana blockchain
        // For now: simulate transaction submission
        const mockTxSignature = `tx_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 9)}`;
        
        txSignatures.push(mockTxSignature);
        
        console.log(`✅ Transaction ${i + 1}/${transactions.length} submitted: ${mockTxSignature.substring(0, 16)}...`);

      } catch (error) {
        console.error(`❌ Failed to submit transaction ${i}:`, error);
      }
    }

    return txSignatures;
  }

  /**
   * Combine multiple decryption results
   */
  private combineDecryptionResults(results: CoordinationResult[]): CoordinationResult {
    const allResponses = results.flatMap(r => r.responses);
    const allFailedExecutors = results.flatMap(r => r.failedExecutors);
    const totalExecutionTime = results.reduce((sum, r) => sum + r.executionTime, 0);

    return {
      success: results.every(r => r.success),
      responses: allResponses,
      failedExecutors: Array.from(new Set(allFailedExecutors)), // Remove duplicates
      executionTime: totalExecutionTime,
    };
  }

  /**
   * Create timeout promise for requests
   */
  private createTimeoutPromise(timeout: number): Promise<null> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), timeout);
    });
  }

  /**
   * Make HTTP request to remote executor
   */
  private async makeHttpRequest(url: string, data: any, timeout: number): Promise<any> {
    // In production: use actual HTTP client like fetch or axios
    // For now: simulate network request
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.1) { // 90% success rate
          resolve({ success: true, data: 'mock_response' });
        } else {
          reject(new Error('Network error'));
        }
      }, Math.random() * 100 + 50); // 50-150ms latency
    });
  }

  /**
   * Update coordination statistics
   */
  private updateCoordinationStats(success: boolean, executionTime: number): void {
    this.coordinationStats.totalRequests++;
    
    if (success) {
      this.coordinationStats.successfulRequests++;
    }

    // Update rolling average
    const alpha = 0.1; // Smoothing factor
    this.coordinationStats.averageResponseTime = 
      alpha * executionTime + (1 - alpha) * this.coordinationStats.averageResponseTime;
  }

  /**
   * Get coordination statistics
   */
  getCoordinationStats(): typeof this.coordinationStats {
    return { ...this.coordinationStats };
  }

  /**
   * Shutdown all executors gracefully
   */
  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down executor coordinator...');

    const shutdownPromises = this.executors.map(async (executor) => {
      if (executor.nodeService) {
        await executor.nodeService.shutdown();
      }
    });

    await Promise.all(shutdownPromises);

    console.log('✅ Executor coordinator shutdown complete');
  }
}