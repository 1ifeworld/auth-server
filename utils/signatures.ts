import { ed25519 } from '@noble/curves/ed25519'
import { base16 } from '@scure/base'

export function signWithEddsaKey(
  message: Uint8Array,
  privateKey: Uint8Array,
): Uint8Array {
  const sig = ed25519.sign(message, privateKey)

  return sig
}

export function verifyMessage(
  message: string,
  signedMessage: string,
  pubKey: string,
): boolean {
  const msg = new TextEncoder().encode(message)
  const sig = base16.decode(signedMessage)
  const pub = base16.decode(pubKey)
  return ed25519.verify(sig, msg, pub)
}
