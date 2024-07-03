import { ed25519 } from '@noble/curves/ed25519'
import type { Message } from '../utils/types'

export function signWithEddsaKey(
  message: string,
  privateKey: Uint8Array,
): Uint8Array {
  const msg = new TextEncoder().encode(message)
  const sig = ed25519.sign(msg, privateKey)

  return sig
}

export function verifyMessage(
  message: string,
  signedMessage: string,
  pubKey: string,
): boolean {
  const msg = new TextEncoder().encode(message)
  const sig = Buffer.from(signedMessage, 'hex')
  const pub = Buffer.from(pubKey, 'hex')
  return ed25519.verify(sig, msg, pub)
}
