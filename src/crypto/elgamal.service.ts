import { randomBytes } from 'crypto'

export type ECPoint = { x: bigint, y: bigint }
export type Ciphertext = { c1: ECPoint, c2: ECPoint }
export type ElGamalKeyPair = { sk: bigint, pk: ECPoint }

export class ElGamalService {
  static generateKeyPair(): ElGamalKeyPair {
    const sk = BigInt('0x' + randomBytes(32).toString('hex'))
    const pk = { x: sk * BigInt(2), y: sk * BigInt(3) }
    return { sk, pk }
  }

  static encrypt(pk: ECPoint, m: bigint): Ciphertext {
    const r = BigInt('0x' + randomBytes(16).toString('hex'))
    const c1 = { x: r * BigInt(2), y: r * BigInt(3) }
    const c2 = { x: m + pk.x * r, y: m + pk.y * r }
    return { c1, c2 }
  }

  static decrypt(sk: bigint, ciphertext: Ciphertext): bigint {
    const m = ciphertext.c2.x - sk * ciphertext.c1.x
    return m
  }
}
