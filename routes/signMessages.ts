import { ed25519 } from '@noble/curves/ed25519'
import { blake3 } from '@noble/hashes/blake3'
import { base16, base64 } from '@scure/base'
import { bytesToHex, type Hex } from 'viem'
import { app } from '../app'
import { messageDataToHash } from '../lib/buffers'
import { kms } from '../clients/aws'
import { authDb } from '../database/watcher'
import { selectKeysQuery, selectSessionQuery } from '../lib/queries'
import { lucia } from '../lucia/auth'
import { signWithEddsaKey } from '../lib/signatures'
import type { Message, RequestPayload } from '../lib/types'
import { isMessage } from '../lib/types'
import { sign } from 'viem/accounts'
import {
  deserializeMessageForHttp,
  serializeMessageForHttp,
} from '../lib/buffers'

function safeStringify(obj: any): string {
  return JSON.stringify(obj, (_, v) =>
    typeof v === 'bigint' ? v.toString() : v,
  )
}

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

    console.log({ json: c.req.json() })

    const { session } = await lucia.validateSession(sessionId)

    if (!session) {
      return c.json({ success: false, message: 'Invalid session' }, 404)
    }

    const deserializedMessages = messages.map((message) => {
      return deserializeMessageForHttp(message)
    })

    console.log({ deserializedMessages })
    console.log({ message: deserializedMessages[0].messageData.rid })

    // deserialize
    // lucia wants userid to be string. since its a direct relationship it makes it so our user table is also a string. maybe there's a workaround

    const userId = deserializedMessages[0].messageData.rid.toString()

    // change big int type in db
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

    const signedMessages: Message[] = []

    for (const message of deserializedMessages) {
      // if (!isMessage(message)) {
      //   return c.json(
      //     { success: false, message: 'Invalid message format' },
      //     400,
      //   )
      // }

      const eddsaPrivateKey = new Uint8Array(
        decryptedPrivateKey.Plaintext as ArrayBuffer,
      )

      const computedHash = messageDataToHash(message.messageData)

      const bytesSignature = signWithEddsaKey(computedHash, eddsaPrivateKey)

      // will need to serialize back via serialize for htttp

      const signedMessage: Message = {
        signer: new Uint8Array(base64.decode(publickey)),
        messageData: message.messageData,
        hashType: message.hashType,
        hash: computedHash,
        sigType: message.sigType,
        sig: bytesSignature,
      }

      signedMessages.push(signedMessage)
    }

    const serializedSignedMessages = signedMessages.map(serializeMessageForHttp)

    return c.json({
      success: true,
      signedMessages: serializedSignedMessages,
    })
  } catch (error: unknown) {
    let errorMessage = 'An unknown error occurred'
    if (error instanceof Error) {
      errorMessage = error.message
    }
    return c.json({ success: false, message: errorMessage }, 500)
  }
})
