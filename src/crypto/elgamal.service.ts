import { randomBytes } from 'crypto'

export type ECPoint = { x: bigint, y: bigint }
export type Ciphertext = { c1: ECPoint, c2: ECPoint }
export type ElGamalKeyPair = { sk: bigint, pk: ECPoint }
export type OrderProof = { 
  commitment: ECPoint, 
  proof: string,
  nullifier: string 
}

const CURVE_ORDER = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141')
const GENERATOR = { x: BigInt('0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798'), y: BigInt('0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8') }

export class ElGamalService {
  static generateKeyPair(): ElGamalKeyPair {
    const sk = this.randomScalar()
    const pk = this.scalarMult(GENERATOR, sk)
    return { sk, pk }
  }

  static encrypt(pk: ECPoint, amount: bigint): Ciphertext {
    const r = this.randomScalar()
    const c1 = this.scalarMult(GENERATOR, r)
    const sharedSecret = this.scalarMult(pk, r)
    const encodedAmount = this.scalarMult(GENERATOR, amount)
    const c2 = this.pointAdd(encodedAmount, sharedSecret)
    return { c1, c2 }
  }

  static decrypt(sk: bigint, ciphertext: Ciphertext): bigint {
    const sharedSecret = this.scalarMult(ciphertext.c1, sk)
    const encodedAmount = this.pointSub(ciphertext.c2, sharedSecret)
    return this.discreteLog(encodedAmount)
  }

  static homomorphicAdd(c1: Ciphertext, c2: Ciphertext): Ciphertext {
    return {
      c1: this.pointAdd(c1.c1, c2.c1),
      c2: this.pointAdd(c1.c2, c2.c2)
    }
  }

  static generateOrderProof(order: any, keyPair: ElGamalKeyPair): OrderProof {
    const commitment = this.scalarMult(GENERATOR, BigInt(order.amount))
    const proof = this.generateZKProof(order, keyPair)
    const nullifier = this.generateNullifier(order.trader, order.timestamp)
    return { commitment, proof, nullifier }
  }

  private static randomScalar(): bigint {
    let scalar: bigint
    do {
      scalar = BigInt('0x' + randomBytes(32).toString('hex'))
    } while (scalar >= CURVE_ORDER)
    return scalar
  }

  private static scalarMult(point: ECPoint, scalar: bigint): ECPoint {
    if (scalar === BigInt(0)) return { x: BigInt(0), y: BigInt(0) }
    let result = point
    let addend = point
    scalar = scalar - BigInt(1)
    
    while (scalar > BigInt(0)) {
      if (scalar & BigInt(1)) {
        result = this.pointAdd(result, addend)
      }
      addend = this.pointDouble(addend)
      scalar = scalar >> BigInt(1)
    }
    return result
  }

  private static pointAdd(p1: ECPoint, p2: ECPoint): ECPoint {
    if (p1.x === BigInt(0) && p1.y === BigInt(0)) return p2
    if (p2.x === BigInt(0) && p2.y === BigInt(0)) return p1
    
    const p = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F')
    const lambda = ((p2.y - p1.y) * this.modInverse(p2.x - p1.x, p)) % p
    const x3 = (lambda * lambda - p1.x - p2.x) % p
    const y3 = (lambda * (p1.x - x3) - p1.y) % p
    
    return { x: x3 < 0 ? x3 + p : x3, y: y3 < 0 ? y3 + p : y3 }
  }

  private static pointSub(p1: ECPoint, p2: ECPoint): ECPoint {
    const p = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F')
    const negP2 = { x: p2.x, y: p - p2.y }
    return this.pointAdd(p1, negP2)
  }

  private static pointDouble(point: ECPoint): ECPoint {
    const p = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F')
    const lambda = (BigInt(3) * point.x * point.x * this.modInverse(BigInt(2) * point.y, p)) % p
    const x3 = (lambda * lambda - BigInt(2) * point.x) % p
    const y3 = (lambda * (point.x - x3) - point.y) % p
    
    return { x: x3 < 0 ? x3 + p : x3, y: y3 < 0 ? y3 + p : y3 }
  }

  private static modInverse(a: bigint, m: bigint): bigint {
    if (a < 0) a = (a % m + m) % m
    const g = this.extendedGCD(a, m)
    if (g.gcd !== BigInt(1)) throw new Error('Modular inverse does not exist')
    return (g.x % m + m) % m
  }

  private static extendedGCD(a: bigint, b: bigint): { gcd: bigint, x: bigint, y: bigint } {
    if (a === BigInt(0)) return { gcd: b, x: BigInt(0), y: BigInt(1) }
    const result = this.extendedGCD(b % a, a)
    return {
      gcd: result.gcd,
      x: result.y - (b / a) * result.x,
      y: result.x
    }
  }

  private static discreteLog(point: ECPoint): bigint {
    for (let i = BigInt(0); i < BigInt(10000); i++) {
      const test = this.scalarMult(GENERATOR, i)
      if (test.x === point.x && test.y === point.y) return i
    }
    throw new Error('Discrete log not found in range')
  }

  private static generateZKProof(order: any, keyPair: ElGamalKeyPair): string {
    const challenge = this.hashToScalar(`${order.amount}${order.price}${keyPair.pk.x}`)
    const response = (challenge * keyPair.sk + BigInt(order.amount)) % CURVE_ORDER
    return `${challenge.toString(16)}-${response.toString(16)}`
  }

  private static generateNullifier(trader: string, timestamp: number): string {
    return this.hashToScalar(`${trader}${timestamp}`).toString(16)
  }

  private static hashToScalar(input: string): bigint {
    const hash = randomBytes(32)
    const scalar = BigInt('0x' + hash.toString('hex'))
    return scalar % CURVE_ORDER
  }
}
