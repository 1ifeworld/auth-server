import { ed25519 } from '@noble/curves/ed25519'
import { blake3 } from '@noble/hashes/blake3'
import { base64 } from '@scure/base'
import { messageDataToUint8Array } from '../buffers/buffers'
import { kms } from '../clients/aws'
import { authDb } from '../database/watcher'
import { selectKeysQuery, selectSessionQuery } from '../lib/queries'
import { signMessageWithKey } from '../lib/signatures'
import { lucia } from '../lucia/auth'
import { app } from '../server'
import type { Message } from '../utils/types'
import { isMessage } from '../utils/types'

app.post('/signMessage', async (c) => {
  try {
    const { sessionId, message } = await c.req.json()

    if (!sessionId || !message) {
      return c.json({ success: false, message: 'Missing parameters' }, 400)
    }

    if (!isMessage(message)) {
      return c.json({ success: false, message: 'Invalid message format' }, 400)
    }

    const { session, user } = await lucia.validateSession(sessionId)

    if (!session) {
      return c.json({ success: false, message: 'Invalid session' }, 404)
    }

    const sessionResult = await authDb.query(selectSessionQuery, [sessionId])
    const { userid } = sessionResult.rows[0]

    if (userid.toString() !== message.messageData.rid) {
      return c.json({ success: false, message: 'RID mismatch' }, 400)
    }

    const keysResult = await authDb.query(selectKeysQuery, [userid])

    if (keysResult.rows.length === 0) {
      return c.json({ success: false, message: 'Keys not found' }, 404)
    }

    const { encryptedprivatekey, publickey } = keysResult.rows[0]

    console.log('HRE', publickey)

    const computedHash = blake3(messageDataToUint8Array(message.messageData))

    const computedHashBase64 = base64.encode(computedHash)
    console.log({ computedHashBase64 })
    console.log({ messagehash: message.hash })

    if (computedHashBase64 !== message.hash) {
      return c.json({ success: false, message: 'Invalid message hash' }, 400)
    }

    // Decrypt the private key using AWS KMS
    const decryptedPrivateKey = await kms
      .decrypt({
        CiphertextBlob: Buffer.from(encryptedprivatekey, 'base64'),
      })
      .promise()

    if (!decryptedPrivateKey.Plaintext) {
      throw new Error('Decryption failed')
    }

    const eddsaPrivateKey = new Uint8Array(
      decryptedPrivateKey.Plaintext as ArrayBuffer,
    )
    const signature = signMessageWithKey(message.hash, eddsaPrivateKey)
    const signerUInt8Array = ed25519.getPublicKey(eddsaPrivateKey)
    const signer = Buffer.from(signerUInt8Array).toString('hex')

    const signedMessage: Message = {
      signer: signer,
      messageType: 1,
      messageData: message.messageData,
      hashType: message.hashType,
      hash: message.hash,
      sigType: 1,
      sig: Buffer.from(signature).toString('hex'),
    }

    return c.json({
      success: true,
      signedMessage,
    })
  } catch (error: unknown) {
    let errorMessage = 'An unknown error occurred'
    if (error instanceof Error) {
      errorMessage = error.message
    }
    return c.json({ success: false, message: errorMessage }, 500)
  }
})
