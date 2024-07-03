import { ed25519 } from '@noble/curves/ed25519'
import { blake3 } from '@noble/hashes/blake3'
import { base16, base64 } from '@scure/base'
import { bytesToHex } from 'viem'
import { app } from '../app'
import { messageDataToUint8Array } from '../buffers/buffers'
import { kms } from '../clients/aws'
import { authDb } from '../database/watcher'
import { selectKeysQuery, selectSessionQuery } from '../lib/queries'
import { lucia } from '../lucia/auth'
import { signWithEddsaKey } from '../utils/signatures'
import type { Message, RequestPayload } from '../utils/types'
import { isMessage } from '../utils/types'

app.post('/signMessages', async (c) => {
  try {
    const { sessionId, messages } = (await c.req.json()) as RequestPayload

    // maybe too much .. 
    
    if (
      !sessionId ||
      !messages ||
      !Array.isArray(messages) ||
      messages.length === 0
    ) {
      return c.json(
        { success: false, message: 'Missing or invalid parameters' },
        400,
      )
    }

    const { session } = await lucia.validateSession(sessionId)

    if (!session) {
      return c.json({ success: false, message: 'Invalid session' }, 404)
    }

    const signedMessages: Message[] = []

    const userId = messages[0].messageData.rid.toString()

    const keysResult = await authDb.query(selectKeysQuery, [userId])

    if (keysResult.rows.length === 0) {
      return c.json({ success: false, message: 'Keys not found' }, 404)
    }

    const { encryptedPrivatekey, publicKey } = keysResult.rows[0]

    for (const message of messages) {
      if (!isMessage(message)) {
        return c.json(
          { success: false, message: 'Invalid message format' },
          400,
        )
      }

      const decryptedPrivateKey = await kms
        .decrypt({
          CiphertextBlob: base64.decode(encryptedPrivatekey),
        })
        .promise()

      if (!decryptedPrivateKey.Plaintext) {
        throw new Error('Decryption failed')
      }

      const eddsaPrivateKey = new Uint8Array(
        decryptedPrivateKey.Plaintext as ArrayBuffer,
      )

      const computedHash = blake3(messageDataToUint8Array(message.messageData))

      if (
        !computedHash.every((value, index) => value === message.hash[index])
      ) {
        return c.json({ success: false, message: 'Invalid message hash' }, 400)
      }

      const signature = signWithEddsaKey(message.hash, eddsaPrivateKey)

      const signerUInt8Array = ed25519.getPublicKey(eddsaPrivateKey)

      const signer = bytesToHex(signerUInt8Array)

      if (publicKey !== signer) {
        return c.json({ success: false, message: 'Public key mismatch' }, 400)
      }

      const signedMessage: Message = {
        signer,
        messageType: message.messageType,
        messageData: message.messageData,
        hashType: message.hashType,
        hash: message.hash,
        sigType: message.sigType,
        sig: signature,
      }

      signedMessages.push(signedMessage)
    }

    return c.json({ success: true, signedMessages })
  } catch (error: unknown) {
    let errorMessage = 'An unknown error occurred'
    if (error instanceof Error) {
      errorMessage = error.message
    }
    return c.json({ success: false, message: errorMessage }, 500)
  }
})
