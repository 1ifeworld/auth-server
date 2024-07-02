import { ed25519 } from '@noble/curves/ed25519'

export const USER_ID_1_PRIV_KEY = process.env.USER_ID_1_PRIV_KEY
if (!USER_ID_1_PRIV_KEY) {
  throw new Error('USER_1_PRIVATE_KEY environment variable is not defined')
}

// Convert hex string to Uint8Array if necessary
export const privKeyBytes = new Uint8Array(
  Buffer.from(USER_ID_1_PRIV_KEY, 'hex'),
)
export const USER_ID_1_PUB_KEY = ed25519.getPublicKey(USER_ID_1_PRIV_KEY)

export const publicKey = ed25519.getPublicKey(privKeyBytes)
console.log({ publicKey })

export const custodyAddress = Buffer.from(publicKey).toString('hex')
console.log({ custodyAddress })

export const KEY_REF = process.env.KEY_REF!
