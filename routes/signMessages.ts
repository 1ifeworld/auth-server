import { ed25519 } from '@noble/curves/ed25519'
import { blake3 } from '@noble/hashes/blake3'
import { base16, base64 } from '@scure/base'
import { bytesToHex, type Hex } from 'viem'
import { app } from '../app'
import { messageDataToUint8Array } from '../lib/buffers'
import { kms } from '../clients/aws'
import { authDb } from '../database/watcher'
import { selectKeysQuery, selectSessionQuery } from '../lib/queries'
import { lucia } from '../lucia/auth'
import { signWithEddsaKey } from '../lib/signatures'
import type { Message, RequestPayload } from '../lib/types'
import { isMessage } from '../lib/types'
import { sign } from 'viem/accounts'

app.post('/signMessages', async (c) => {
  try {
    const { sessionId, messages } = (await c.req.json()) as RequestPayload

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

    // these are not camel cased because these are the names of the columns in the table

    const { encryptedprivatekey, publickey } = keysResult.rows[0]

    const decryptedPrivateKey = await kms
      .decrypt({
        CiphertextBlob: base64.decode(encryptedprivatekey),
      })
      .promise()

    if (!decryptedPrivateKey.Plaintext) {
      throw new Error('Decryption failed')
    }

    for (const message of messages) {
      if (!isMessage(message)) {
        return c.json(
          { success: false, message: 'Invalid message format' },
          400,
        )
      }

      const eddsaPrivateKey = new Uint8Array(
        decryptedPrivateKey.Plaintext as ArrayBuffer,
      )

      const computedHash = bytesToHex(
        blake3(messageDataToUint8Array(message.messageData)),
      )

      if (computedHash.slice(2) !== message.hash.slice(2)) {
        return c.json({ success: false, message: 'Invalid message hash' }, 400)
      }
      
      const slicedPrefixHash = message.hash.slice(2) as Hex
      const bytesSignature = signWithEddsaKey(slicedPrefixHash, eddsaPrivateKey)
      const signature = bytesToHex(bytesSignature)

      const signedMessage: Message = {
        signer: publickey,
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
