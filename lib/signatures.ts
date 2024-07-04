import { ed25519 } from '@noble/curves/ed25519'
import { base16 } from '@scure/base'
import type { Hex } from 'viem'

export function signWithEddsaKey(
  message: Hex,
  privateKey: Uint8Array,
): Uint8Array {
  const sig = ed25519.sign(message, privateKey)

  return sig
}
