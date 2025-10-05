import { randomBytes } from 'crypto'
import { secp256k1 } from '@noble/curves'

export type ECPoint = { x: bigint, y: bigint }
export type Ciphertext = { c1: ECPoint, c2: ECPoint }
export type ElGamalKeyPair = { sk: bigint, pk: ECPoint }


function toPoint(p: any): ECPoint {
  return { x: p.x, y: p.y }
}

export class ElGamalService {
  static generateKeyPair(): ElGamalKeyPair {
    const sk = BigInt('0x' + randomBytes(32).toString('hex')) % secp256k1.CURVE.n
    const pkPoint = secp256k1.ProjectivePoint.BASE.multiply(sk)
    return { sk, pk: toPoint(pkPoint) }
  }

  static encrypt(pk: ECPoint, m: bigint) {
    const r = BigInt('0x' + randomBytes(32).toString('hex')) % secp256k1.CURVE.n
    const C1 = secp256k1.ProjectivePoint.BASE.multiply(r)
    const pkPoint = secp256k1.ProjectivePoint.fromHex(secp256k1.utils.hexFromBigint(pk.x) + secp256k1.utils.hexFromBigint(pk.y))
    const C2 = secp256k1.ProjectivePoint.BASE.multiply(m).add(pkPoint.multiply(r))
    return { c1: toPoint(C1), c2: toPoint(C2) }
  }

  static decrypt(sk: bigint, ciphertext: Ciphertext) {
    const C1 = secp256k1.ProjectivePoint.fromHex(secp256k1.utils.hexFromBigint(ciphertext.c1.x) + secp256k1.utils.hexFromBigint(ciphertext.c1.y))
    const C2 = secp256k1.ProjectivePoint.fromHex(secp256k1.utils.hexFromBigint(ciphertext.c2.x) + secp256k1.utils.hexFromBigint(ciphertext.c2.y))
    const M = C2.subtract(C1.multiply(sk))
    return M
  }
}
