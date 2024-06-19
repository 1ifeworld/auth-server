import { ed25519 } from '@noble/curves/ed25519'
import { privKeyBytes } from './keys'

export function signMessage(message: string) {
  const msg = new TextEncoder().encode(message)
  const sig = ed25519.sign(msg, privKeyBytes)
  return Buffer.from(sig).toString('hex')
}

export function signMessageWithKey(
  message: string,
  privateKey: Uint8Array,
): string {
  const msg = new TextEncoder().encode(message)
  const sig = ed25519.sign(msg, privateKey)
  return Buffer.from(sig).toString('hex')
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
