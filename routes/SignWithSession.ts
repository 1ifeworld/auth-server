import { Hono } from 'hono'
import { kms } from '../clients/aws'
import { writeClient } from '../database/watcher'
import { KEY_REF } from '../lib/keys'
import { signMessageWithKey } from '../lib/signatures'
import { lucia } from '../lucia/auth'

export const signWithSession = new Hono()

signWithSession.post('/signMessageWithSession', async (c) => {
  try {
    const { sessionId, message } = await c.req.json()

    if (!sessionId || !message) {
      return c.json({ success: false, message: 'Missing parameters' }, 400)
    }

    const { session, user } = await lucia.validateSession(sessionId)

    if (!session) {
      return c.json({ success: false, message: 'Invalid session' }, 404)
    }

    const selectSessionQuery = `
      SELECT userid FROM public.sessions
      WHERE id = $1
    `
    const sessionResult = await writeClient.query(selectSessionQuery, [
      sessionId,
    ])
    console.log({ sessionResult })

    if (sessionResult.rows.length === 0) {
      return c.json({ success: false, message: 'Invalid session' }, 404)
    }

    const { userid } = sessionResult.rows[0]

    // Retrieve the stored encrypted keys
    const selectKeysQuery = `
      SELECT encryptedprivatekey FROM public.hashes
      WHERE userid = $1
    `
    const keysResult = await writeClient.query(selectKeysQuery, [userid])

    if (keysResult.rows.length === 0) {
      return c.json({ success: false, message: 'Keys not found' }, 404)
    }

    const { encryptedprivatekey } = keysResult.rows[0]

    // Decrypt the private key using AWS KMS
    const decryptedPrivateKey = await kms
      .decrypt({
        CiphertextBlob: Buffer.from(encryptedprivatekey, 'base64'),
      })
      .promise()

    if (!decryptedPrivateKey.Plaintext) {
      throw new Error('Decryption failed')
    }

    // Sign the message with the decrypted EDDSA private key
    const eddsaPrivateKey = new Uint8Array(
      decryptedPrivateKey.Plaintext as ArrayBuffer,
    )
    const signedMessage = signMessageWithKey(message, eddsaPrivateKey)

    // Re-encrypt the private key using AWS KMS
    const reEncryptedPrivateKey = await kms
      .encrypt({
        KeyId: KEY_REF,
        Plaintext: Buffer.from(eddsaPrivateKey),
      })
      .promise()

    if (!reEncryptedPrivateKey.CiphertextBlob) {
      throw new Error('Re-encryption failed')
    }

    const updateKeysQuery = `
      UPDATE public.hashes
      SET encryptedprivatekey = $1
      WHERE userid = $2
    `
    await writeClient.query(updateKeysQuery, [
      reEncryptedPrivateKey.CiphertextBlob.toString('base64'),
      userid,
    ])

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
