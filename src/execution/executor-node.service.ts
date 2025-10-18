/**
 * Threshold Executor Node Service
 * Individual executor that participates in 3-of-5 threshold decryption network
 * Provides partial decryptions and signs execution transactions
 */

import { randomBytes, createHash } from 'crypto';
const BN = require('bn.js');
type BNInstance = InstanceType<typeof BN>;
import { ThresholdProductionService } from '../crypto/threshold.production.service';
import { ZKProofProductionService } from '../crypto/zkproof.production.service';

interface ExecutorConfig {
  executorId: number;
  secretShare: BNInstance;
  port: number;
  executorPrivateKey: Uint8Array;
}

interface PartialDecryptionRequest {
  ciphertext: {
    C1: { x: string; y: string };
    C2: { x: string; y: string };
  };
  requestId: string;
  timestamp: number;
}

interface PartialDecryptionResponse {
  executorId: number;
  partialDecryption: {
    x: string;
    y: string;
  };
  proof: {
    challenge: string;
    response: string;
    publicKeyShare: string;
  };
  timestamp: number;
  requestId: string;
}

interface SignatureRequest {
  transaction: string;
  matchProof: any;
  requestId: string;
}

interface SignatureResponse {
  executorId: number;
  signature: string;
  publicKey: string;
  timestamp: number;
}

interface ExecutorHealth {
  executorId: number;
  status: 'healthy' | 'degraded' | 'offline';
  uptime: number;
  lastHeartbeat: number;
  totalDecryptions: number;
  totalSignatures: number;
  errorRate: number;
  responseTime: number;
}

export class ExecutorNodeService {
  private config: ExecutorConfig;
  private threshold: ThresholdProductionService;
  private zkproof: ZKProofProductionService;
  private stats: {
    totalDecryptions: number;
    totalSignatures: number;
    errorCount: number;
    startTime: number;
    lastHeartbeat: number;
  };

  constructor(config: ExecutorConfig) {
    this.config = config;
    this.threshold = new ThresholdProductionService();
    this.zkproof = new ZKProofProductionService();
    
    this.stats = {
      totalDecryptions: 0,
      totalSignatures: 0,
      errorCount: 0,
      startTime: Date.now(),
      lastHeartbeat: Date.now(),
    };

    console.log(`🔧 Executor ${config.executorId} initialized`);
  }

  /**
   * Health check endpoint
   * Returns current status and performance metrics
   */
  getHealth(): ExecutorHealth {
    const now = Date.now();
    const uptime = Math.floor((now - this.stats.startTime) / 1000);
    const errorRate = this.stats.errorCount / Math.max(1, this.stats.totalDecryptions + this.stats.totalSignatures);
    
    // Update heartbeat
    this.stats.lastHeartbeat = now;

    return {
      executorId: this.config.executorId,
      status: this.determineStatus(errorRate),
      uptime,
      lastHeartbeat: this.stats.lastHeartbeat,
      totalDecryptions: this.stats.totalDecryptions,
      totalSignatures: this.stats.totalSignatures,
      errorRate: Math.round(errorRate * 100),
      responseTime: this.calculateAverageResponseTime(),
    };
  }

  /**
   * Provide partial decryption for threshold scheme
   * Core function for trustless order decryption
   */
  async partialDecrypt(request: PartialDecryptionRequest): Promise<PartialDecryptionResponse> {
    const startTime = Date.now();

    try {
      // 1. Validate request
      this.validateDecryptionRequest(request);

      // 2. Perform partial decryption using secret share
      const partialDecryption = this.threshold.partialDecrypt(
        request.ciphertext,
        this.config.secretShare,
        this.config.executorId
      );

      // 3. Update statistics
      this.stats.totalDecryptions++;
      this.stats.lastHeartbeat = Date.now();

      console.log(`✅ Executor ${this.config.executorId}: Partial decryption completed in ${Date.now() - startTime}ms`);

      return {
        executorId: this.config.executorId,
        partialDecryption: partialDecryption.partialValue,
        proof: partialDecryption.proof,
        timestamp: Date.now(),
        requestId: request.requestId,
      };

    } catch (error) {
      this.stats.errorCount++;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      console.error(`❌ Executor ${this.config.executorId}: Partial decryption failed - ${errorMessage}`);
      throw new Error(`Partial decryption failed: ${errorMessage}`);
    }
  }

  /**
   * Sign execution transaction after verifying matching proof
   * Ensures trades are executed only with valid proofs
   */
  async signExecution(request: SignatureRequest): Promise<SignatureResponse> {
    const startTime = Date.now();

    try {
      // 1. Validate signature request
      this.validateSignatureRequest(request);

      // 2. Verify matching proof
      const isValidProof = await this.zkproof.verifyProof(request.matchProof);
      if (!isValidProof) {
        throw new Error('Invalid matching proof - refusing to sign');
      }

      // 3. Validate transaction structure
      const isValidTransaction = this.validateTransaction(request.transaction);
      if (!isValidTransaction) {
        throw new Error('Invalid transaction structure');
      }

      // 4. Sign transaction with executor private key
      const signature = this.signTransaction(request.transaction);

      // 5. Update statistics
      this.stats.totalSignatures++;
      this.stats.lastHeartbeat = Date.now();

      console.log(`✅ Executor ${this.config.executorId}: Transaction signed in ${Date.now() - startTime}ms`);

      return {
        executorId: this.config.executorId,
        signature,
        publicKey: this.getPublicKey(),
        timestamp: Date.now(),
      };

    } catch (error) {
      this.stats.errorCount++;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      console.error(`❌ Executor ${this.config.executorId}: Transaction signing failed - ${errorMessage}`);
      throw new Error(`Transaction signing failed: ${errorMessage}`);
    }
  }

  /**
   * Batch process multiple partial decryptions
   * Optimized for high-throughput matching rounds
   */
  async batchPartialDecrypt(requests: PartialDecryptionRequest[]): Promise<PartialDecryptionResponse[]> {
    const startTime = Date.now();
    const responses: PartialDecryptionResponse[] = [];
    
    console.log(`🔄 Executor ${this.config.executorId}: Processing ${requests.length} partial decryptions`);

    for (const request of requests) {
      try {
        const response = await this.partialDecrypt(request);
        responses.push(response);
      } catch (error) {
        console.warn(`⚠️ Skipping failed decryption for request ${request.requestId}`);
        // Continue with other requests
      }
    }

    console.log(`✅ Executor ${this.config.executorId}: Batch completed - ${responses.length}/${requests.length} successful in ${Date.now() - startTime}ms`);
    
    return responses;
  }

  /**
   * Validate decryption request
   */
  private validateDecryptionRequest(request: PartialDecryptionRequest): void {
    // Check request age (reject if older than 60 seconds)
    const now = Date.now();
    if (Math.abs(now - request.timestamp) > 60000) {
      throw new Error('Request too old or from future');
    }

    // Validate ciphertext structure
    if (!request.ciphertext || 
        !request.ciphertext.C1 || 
        !request.ciphertext.C2 ||
        !request.ciphertext.C1.x ||
        !request.ciphertext.C1.y ||
        !request.ciphertext.C2.x ||
        !request.ciphertext.C2.y) {
      throw new Error('Invalid ciphertext format');
    }

    // Validate hex strings
    if (!this.isValidHex(request.ciphertext.C1.x) ||
        !this.isValidHex(request.ciphertext.C1.y) ||
        !this.isValidHex(request.ciphertext.C2.x) ||
        !this.isValidHex(request.ciphertext.C2.y)) {
      throw new Error('Invalid hex coordinates');
    }

    // Validate request ID
    if (!request.requestId || request.requestId.length < 10) {
      throw new Error('Invalid request ID');
    }
  }

  /**
   * Validate signature request
   */
  private validateSignatureRequest(request: SignatureRequest): void {
    if (!request.transaction || request.transaction.length === 0) {
      throw new Error('Empty transaction');
    }

    if (!request.matchProof) {
      throw new Error('Missing matching proof');
    }

    if (!request.requestId) {
      throw new Error('Missing request ID');
    }
  }

  /**
   * Validate transaction structure
   */
  private validateTransaction(transaction: string): boolean {
    try {
      // Basic validation - in production: parse and validate Solana transaction
      const decoded = Buffer.from(transaction, 'base64');
      
      // Check minimum transaction size
      if (decoded.length < 64) {
        return false;
      }

      // Check for required fields (simplified)
      return true;

    } catch (error) {
      return false;
    }
  }

  /**
   * Sign transaction with executor private key
   */
  private signTransaction(transaction: string): string {
    try {
      // Create transaction hash
      const transactionBytes = Buffer.from(transaction, 'base64');
      const hash = createHash('sha256').update(transactionBytes).digest();

      // Create signature using executor private key
      // In production: use proper Ed25519 signing
      const signature = createHash('sha256')
        .update(this.config.executorPrivateKey)
        .update(hash)
        .digest();

      return signature.toString('base64');

    } catch (error) {
      throw new Error('Transaction signing failed');
    }
  }

  /**
   * Get executor public key
   */
  private getPublicKey(): string {
    // Derive public key from private key
    // In production: use proper Ed25519 key derivation
    const publicKey = createHash('sha256')
      .update(this.config.executorPrivateKey)
      .update('public')
      .digest();

    return publicKey.toString('hex');
  }

  /**
   * Determine executor status based on error rate
   */
  private determineStatus(errorRate: number): 'healthy' | 'degraded' | 'offline' {
    const timeSinceHeartbeat = Date.now() - this.stats.lastHeartbeat;

    if (timeSinceHeartbeat > 120000) { // 2 minutes
      return 'offline';
    }

    if (errorRate > 0.1) { // 10% error rate
      return 'degraded';
    }

    return 'healthy';
  }

  /**
   * Calculate average response time
   */
  private calculateAverageResponseTime(): number {
    // Simplified implementation - in production: track actual response times
    const baseTime = 50; // 50ms base response time
    const errorPenalty = this.stats.errorCount * 5; // 5ms per error
    
    return Math.min(baseTime + errorPenalty, 500); // Cap at 500ms
  }

  /**
   * Validate hex string format
   */
  private isValidHex(hex: string): boolean {
    return /^[0-9a-fA-F]+$/.test(hex) && hex.length === 64; // 32 bytes
  }

  /**
   * Reset statistics (for testing/maintenance)
   */
  resetStats(): void {
    this.stats = {
      totalDecryptions: 0,
      totalSignatures: 0,
      errorCount: 0,
      startTime: Date.now(),
      lastHeartbeat: Date.now(),
    };

    console.log(`🔄 Executor ${this.config.executorId}: Statistics reset`);
  }

  /**
   * Get executor configuration (safe - no secrets)
   */
  getConfig(): Partial<ExecutorConfig> {
    return {
      executorId: this.config.executorId,
      port: this.config.port,
    };
  }

  /**
   * Shutdown executor gracefully
   */
  async shutdown(): Promise<void> {
    console.log(`🛑 Executor ${this.config.executorId}: Shutting down gracefully`);
    
    // In production: save state, close connections, etc.
    
    console.log(`✅ Executor ${this.config.executorId}: Shutdown complete`);
  }
}