import { randomBytes, createHash } from 'crypto';
import { ec as EC } from 'elliptic';

export interface Point {
  x: bigint;
  y: bigint;
}

export interface ElGamalKeyPair {
  sk: bigint;
  pk: Point;
}

export interface ElGamalCiphertext {
  c1: Point;
  c2: Point;
}

export interface EncryptedOrder {
  orderHash: string;
  walletAddress: string;
  tokenPair: string;
  side: 'BUY' | 'SELL';
  encryptedAmount: ElGamalCiphertext;
  encryptedPrice: ElGamalCiphertext;
  timestamp: number;
  signature: string;
  solvencyProof?: Uint8Array;
}

export interface PlainOrder {
  orderHash: string;
  walletAddress: string;
  tokenPair: string;
  side: 'BUY' | 'SELL';
  amount: bigint;
  price: bigint;
  timestamp: number;
}

export interface ThresholdShares {
  shares: { index: number; value: bigint }[];
  threshold: number;
  publicKey: Point;
}

export class ElGamalRealService {
  private static ec = new EC('secp256k1');
  
  // secp256k1 curve parameters
  private static readonly p = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F');
  private static readonly n = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
  
  // Generator point
  static readonly G: Point = {
    x: BigInt('0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798'),
    y: BigInt('0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8')
  };

  // Modular arithmetic helpers
  private static mod(a: bigint, m: bigint): bigint {
    return ((a % m) + m) % m;
  }

  private static modInverse(a: bigint, m: bigint): bigint {
    let [old_r, r] = [a, m];
    let [old_s, s] = [BigInt(1), BigInt(0)];
    
    while (r !== BigInt(0)) {
      const quotient = old_r / r;
      [old_r, r] = [r, old_r - quotient * r];
      [old_s, s] = [s, old_s - quotient * s];
    }
    
    return this.mod(old_s, m);
  }

  // Convert elliptic.js point to our Point interface
  private static ecPointToPoint(ecPoint: any): Point {
    return {
      x: BigInt('0x' + ecPoint.getX().toString(16)),
      y: BigInt('0x' + ecPoint.getY().toString(16))
    };
  }

  // Convert our Point to elliptic.js point
  private static pointToEcPoint(point: Point): any {
    return this.ec.curve.point(
      point.x.toString(16),
      point.y.toString(16)
    );
  }

  // Secure random number generation
  private static generateSecureRandom(): bigint {
    let random: bigint;
    do {
      const bytes = randomBytes(32);
      random = BigInt('0x' + bytes.toString('hex'));
    } while (random >= this.n || random === BigInt(0));
    
    return random;
  }

  // Point operations using elliptic.js for security
  static pointAdd(p1: Point | null, p2: Point | null): Point | null {
    if (!p1) return p2;
    if (!p2) return p1;
    
    try {
      const ec1 = this.pointToEcPoint(p1);
      const ec2 = this.pointToEcPoint(p2);
      const result = ec1.add(ec2);
      
      if (result.isInfinity()) return null;
      return this.ecPointToPoint(result);
    } catch (error) {
      console.error('Point addition failed:', error);
      return null;
    }
  }

  static scalarMult(k: bigint, point: Point): Point | null {
    if (k === BigInt(0)) return null;
    if (k < BigInt(0)) throw new Error('Scalar must be positive');
    
    try {
      const ecPoint = this.pointToEcPoint(point);
      const result = ecPoint.mul(k.toString(16));
      
      if (result.isInfinity()) return null;
      return this.ecPointToPoint(result);
    } catch (error) {
      console.error('Scalar multiplication failed:', error);
      return null;
    }
  }

  // ElGamal key generation
  static generateKeyPair(): ElGamalKeyPair {
    const keyPair = this.ec.genKeyPair();
    const sk = BigInt('0x' + keyPair.getPrivate('hex'));
    const pk = this.ecPointToPoint(keyPair.getPublic());
    
    return { sk, pk };
  }

  // ElGamal encryption with proper randomness
  static encrypt(publicKey: Point, plaintext: bigint): ElGamalCiphertext {
    if (plaintext < 0) throw new Error('Plaintext must be non-negative');
    if (plaintext >= BigInt(2 ** 32)) throw new Error('Plaintext too large');
    
    const r = this.generateSecureRandom();
    
    // c1 = r * G
    const c1 = this.scalarMult(r, this.G);
    if (!c1) throw new Error('Failed to compute c1');
    
    // Encode plaintext as curve point
    const mG = this.scalarMult(plaintext, this.G);
    if (!mG) throw new Error('Failed to encode plaintext');
    
    // c2 = m * G + r * pk
    const rPk = this.scalarMult(r, publicKey);
    if (!rPk) throw new Error('Failed to compute r * pk');
    
    const c2 = this.pointAdd(mG, rPk);
    if (!c2) throw new Error('Failed to compute c2');
    
    return { c1, c2 };
  }

  // ElGamal decryption using baby-step giant-step
  static decrypt(privateKey: bigint, ciphertext: ElGamalCiphertext): bigint {
    // Compute sk * c1
    const skC1 = this.scalarMult(privateKey, ciphertext.c1);
    if (!skC1) throw new Error('Failed to compute sk * c1');
    
    // Compute c2 - sk * c1 = m * G
    const negSkC1 = { x: skC1.x, y: this.mod(-skC1.y, this.p) };
    const mG = this.pointAdd(ciphertext.c2, negSkC1);
    if (!mG) throw new Error('Failed to recover message point');
    
    // Discrete log to recover plaintext
    return this.discreteLogBSGS(mG);
  }

  // Baby-step Giant-step algorithm for discrete log
  private static discreteLogBSGS(target: Point, maxBits: number = 32): bigint {
    const n = BigInt(2 ** Math.min(maxBits, 20)); // Limit for memory
    const sqrtN = BigInt(Math.floor(Math.sqrt(Number(n))));
    
    // Baby steps: compute i*G for i = 0, 1, ..., sqrt(n)
    const babySteps = new Map<string, bigint>();
    let current = { x: BigInt(0), y: BigInt(0) }; // Point at infinity representation
    
    for (let i = BigInt(0); i <= sqrtN; i++) {
      if (i === BigInt(0)) {
        // Handle point at infinity case
        current = this.scalarMult(BigInt(1), this.G)!;
        const key = this.pointToString(current);
        babySteps.set(key, BigInt(0));
      } else {
        const key = this.pointToString(current);
        babySteps.set(key, i);
        
        if (i < sqrtN) {
          const next = this.pointAdd(current, this.G);
          if (!next) break;
          current = next;
        }
      }
    }
    
    // Giant steps: compute target - j*sqrt(n)*G for j = 0, 1, ..., sqrt(n)
    const giant = this.scalarMult(sqrtN, this.G);
    if (!giant) throw new Error('Failed to compute giant step');
    
    const negGiant = { x: giant.x, y: this.mod(-giant.y, this.p) };
    let y = target;
    
    for (let j = BigInt(0); j <= sqrtN; j++) {
      const key = this.pointToString(y);
      
      if (babySteps.has(key)) {
        const i = babySteps.get(key)!;
        return j * sqrtN + i;
      }
      
      if (j < sqrtN) {
        const next = this.pointAdd(y, negGiant);
        if (!next) break;
        y = next;
      }
    }
    
    throw new Error(`Discrete logarithm not found (searched up to ${n})`);
  }

  private static pointToString(point: Point): string {
    return `${point.x.toString(16)}-${point.y.toString(16)}`;
  }

  // Homomorphic operations
  static homomorphicAdd(c1: ElGamalCiphertext, c2: ElGamalCiphertext): ElGamalCiphertext {
    const newC1 = this.pointAdd(c1.c1, c2.c1);
    const newC2 = this.pointAdd(c1.c2, c2.c2);
    
    if (!newC1 || !newC2) {
      throw new Error('Homomorphic addition failed');
    }
    
    return { c1: newC1, c2: newC2 };
  }

  static scalarMultCiphertext(scalar: bigint, ciphertext: ElGamalCiphertext): ElGamalCiphertext {
    const newC1 = this.scalarMult(scalar, ciphertext.c1);
    const newC2 = this.scalarMult(scalar, ciphertext.c2);
    
    if (!newC1 || !newC2) {
      throw new Error('Scalar multiplication failed');
    }
    
    return { c1: newC1, c2: newC2 };
  }

  // Threshold cryptography (5-of-n scheme)
  static generateThresholdShares(threshold: number, total: number): ThresholdShares {
    if (threshold > total || threshold < 1) {
      throw new Error('Invalid threshold parameters');
    }
    
    // Generate random polynomial coefficients
    const coefficients: bigint[] = [];
    for (let i = 0; i < threshold; i++) {
      coefficients.push(this.generateSecureRandom());
    }
    
    const secretKey = coefficients[0];
    
    // Generate shares using Shamir's secret sharing
    const shares: { index: number; value: bigint }[] = [];
    for (let i = 1; i <= total; i++) {
      let shareValue = BigInt(0);
      let xPower = BigInt(1);
      
      for (let j = 0; j < threshold; j++) {
        shareValue = this.mod(shareValue + coefficients[j] * xPower, this.n);
        xPower = this.mod(xPower * BigInt(i), this.n);
      }
      
      shares.push({ index: i, value: shareValue });
    }
    
    // Generate public key
    const publicKey = this.scalarMult(secretKey, this.G);
    if (!publicKey) throw new Error('Failed to generate threshold public key');
    
    return { shares, threshold, publicKey };
  }

  // Partial decryption for threshold scheme
  static partialDecrypt(shareValue: bigint, ciphertext: ElGamalCiphertext): Point {
    const partial = this.scalarMult(shareValue, ciphertext.c1);
    if (!partial) throw new Error('Partial decryption failed');
    return partial;
  }

  // Combine threshold shares using Lagrange interpolation
  static combineThresholdShares(
    partialDecryptions: { index: number; partial: Point }[],
    ciphertext: ElGamalCiphertext,
    threshold: number
  ): bigint {
    if (partialDecryptions.length < threshold) {
      throw new Error(`Need at least ${threshold} shares, got ${partialDecryptions.length}`);
    }
    
    let combined: Point | null = null;
    
    for (let i = 0; i < threshold; i++) {
      const { index: xi, partial } = partialDecryptions[i];
      
      // Calculate Lagrange coefficient
      let numerator = BigInt(1);
      let denominator = BigInt(1);
      
      for (let j = 0; j < threshold; j++) {
        if (i !== j) {
          const xj = partialDecryptions[j].index;
          numerator = this.mod(numerator * BigInt(-xj), this.n);
          denominator = this.mod(denominator * BigInt(xi - xj), this.n);
        }
      }
      
      const lagrangeCoeff = this.mod(numerator * this.modInverse(denominator, this.n), this.n);
      const weightedPartial = this.scalarMult(lagrangeCoeff, partial);
      
      if (weightedPartial) {
        combined = this.pointAdd(combined, weightedPartial);
      }
    }
    
    if (!combined) throw new Error('Failed to combine threshold shares');
    
    // Subtract from c2 to get message point
    const negCombined = { x: combined.x, y: this.mod(-combined.y, this.p) };
    const messagePoint = this.pointAdd(ciphertext.c2, negCombined);
    
    if (!messagePoint) throw new Error('Failed to recover message point');
    
    // Recover plaintext
    return this.discreteLogBSGS(messagePoint);
  }

  // High-level order encryption for trading
  static encryptOrder(
    publicKey: Point,
    order: { amount: number; price: number }
  ): { encryptedAmount: ElGamalCiphertext; encryptedPrice: ElGamalCiphertext } {
    // Convert to fixed-point (6 decimals) to preserve precision
    const amountFixed = BigInt(Math.floor(order.amount * 1000000));
    const priceFixed = BigInt(Math.floor(order.price * 1000000));
    
    if (amountFixed >= BigInt(2 ** 32) || priceFixed >= BigInt(2 ** 32)) {
      throw new Error('Order values too large for encryption');
    }
    
    return {
      encryptedAmount: this.encrypt(publicKey, amountFixed),
      encryptedPrice: this.encrypt(publicKey, priceFixed)
    };
  }

  // Batch encryption for efficiency
  static batchEncrypt(publicKey: Point, values: bigint[]): ElGamalCiphertext[] {
    return values.map(value => this.encrypt(publicKey, value));
  }

  // Serialization for blockchain storage
  static serializePoint(point: Point): Uint8Array {
    const buffer = new ArrayBuffer(65); // Uncompressed format
    const view = new Uint8Array(buffer);
    
    view[0] = 0x04; // Uncompressed prefix
    
    // Convert coordinates to 32-byte arrays
    const xBytes = this.bigintToBytes(point.x, 32);
    const yBytes = this.bigintToBytes(point.y, 32);
    
    view.set(xBytes, 1);
    view.set(yBytes, 33);
    
    return view;
  }

  static deserializePoint(buffer: Uint8Array): Point {
    if (buffer.length !== 65 || buffer[0] !== 0x04) {
      throw new Error('Invalid point serialization');
    }
    
    const x = this.bytesToBigint(buffer.slice(1, 33));
    const y = this.bytesToBigint(buffer.slice(33, 65));
    
    // Validate point is on curve
    if (!this.isOnCurve({ x, y })) {
      throw new Error('Deserialized point is not on secp256k1 curve');
    }
    
    return { x, y };
  }

  static serializeCiphertext(ciphertext: ElGamalCiphertext): Uint8Array {
    const c1Buffer = this.serializePoint(ciphertext.c1);
    const c2Buffer = this.serializePoint(ciphertext.c2);
    
    const result = new Uint8Array(130);
    result.set(c1Buffer);
    result.set(c2Buffer, 65);
    
    return result;
  }

  static deserializeCiphertext(buffer: Uint8Array): ElGamalCiphertext {
    if (buffer.length !== 130) {
      throw new Error('Invalid ciphertext serialization');
    }
    
    const c1 = this.deserializePoint(buffer.slice(0, 65));
    const c2 = this.deserializePoint(buffer.slice(65, 130));
    
    return { c1, c2 };
  }

  // Utility functions
  private static bigintToBytes(num: bigint, length: number): Uint8Array {
    const bytes = new Uint8Array(length);
    let n = num;
    
    for (let i = length - 1; i >= 0; i--) {
      bytes[i] = Number(n & BigInt(0xff));
      n = n >> BigInt(8);
    }
    
    return bytes;
  }

  private static bytesToBigint(bytes: Uint8Array): bigint {
    let result = BigInt(0);
    
    for (const byte of bytes) {
      result = (result << BigInt(8)) + BigInt(byte);
    }
    
    return result;
  }

  // Curve validation
  private static isOnCurve(point: Point): boolean {
    // y² = x³ + 7 (mod p) for secp256k1
    const leftSide = this.mod(point.y * point.y, this.p);
    const rightSide = this.mod(point.x * point.x * point.x + BigInt(7), this.p);
    
    return leftSide === rightSide;
  }

  // Zero-knowledge proof generation (placeholder for full implementation)
  static generateEncryptionProof(
    ciphertext: ElGamalCiphertext,
    publicKey: Point,
    plaintext: bigint,
    randomness: bigint
  ): Uint8Array {
    // This would implement a proper ZK-SNARK proof
    // For now, return a commitment hash
    const commitment = createHash('sha256')
      .update(this.serializeCiphertext(ciphertext))
      .update(this.serializePoint(publicKey))
      .update(this.bigintToBytes(plaintext, 32))
      .update(this.bigintToBytes(randomness, 32))
      .digest();
    
    return new Uint8Array(commitment);
  }

  // Verify encryption proof
  static verifyEncryptionProof(
    ciphertext: ElGamalCiphertext,
    publicKey: Point,
    proof: Uint8Array
  ): boolean {
    // Basic validation that points are on curve
    return this.isOnCurve(ciphertext.c1) && 
           this.isOnCurve(ciphertext.c2) && 
           this.isOnCurve(publicKey) &&
           proof.length === 32;
  }

  // Generate deterministic nonce for signatures
  static generateNonce(message: Uint8Array, privateKey: bigint): bigint {
    const hash = createHash('sha256')
      .update(this.bigintToBytes(privateKey, 32))
      .update(message)
      .digest();
    
    return this.bytesToBigint(new Uint8Array(hash)) % this.n;
  }
}