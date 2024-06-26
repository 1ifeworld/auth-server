import { ed25519 } from '@noble/curves/ed25519'
import {
  alphabet,
  generateRandomInteger,
  generateRandomString,
} from 'oslo/crypto'
import { kms } from '../clients/aws'
import { writeClient } from '../database/watcher'
import { KEY_REF, publicKey } from '../lib/keys'
import { verifyMessage } from '../lib/signatures'
import { lucia } from '../lucia/auth'
import { app } from '../server'

app.post('/genKeys', async (c) => {
  console.log('IN ENCRYPT ROUTE')
  try {
    const { message, signedMessage } = await c.req.json()

    if (!message || !signedMessage) {
      return c.json({ success: false, message: 'Missing parameters' }, 400)
    }
    const isValid = verifyMessage(
      message,
      signedMessage,
      Buffer.from(publicKey).toString('hex'),
    )
    if (!isValid) {
      return c.json({ success: false, message: 'Invalid signature' }, 400)
    }

    console.log({ isValid })

    const publicKeyHex = Buffer.from(publicKey).toString('hex')

    const selectHashQuery = `
        SELECT userid FROM public.hashes
        WHERE custodyAddress = $1
      `
    const hashResult = await writeClient.query(selectHashQuery, [publicKeyHex])

    console.log({ hashResult })
    const userId = generateRandomInteger(100)
    let deviceId
    let sessionId

    if (hashResult.rows.length === 0) {
      console.log('first time user!')
      const eddsaPrivateKey = ed25519.utils.randomPrivateKey()
      const eddsaPublicKey = ed25519.getPublicKey(eddsaPrivateKey)
      deviceId = generateRandomString(
        10,
        alphabet('a-z', 'A-Z', '0-9', '-', '_'),
      )

      const encryptedPrivateKey = await kms
        .encrypt({
          KeyId: KEY_REF,
          Plaintext: Buffer.from(eddsaPrivateKey),
        })
        .promise()

      const encryptedPublicKey = await kms
        .encrypt({
          KeyId: KEY_REF,
          Plaintext: Buffer.from(eddsaPublicKey),
        })
        .promise()

      if (
        !encryptedPrivateKey.CiphertextBlob ||
        !encryptedPublicKey.CiphertextBlob
      ) {
        throw new Error('Encryption failed')
      }

      console.log('prestorekeys', { userId, publicKeyHex })

      const insertKeysQuery = `
          INSERT INTO public.hashes (userid, custodyAddress, deviceid, encryptedprivatekey, encryptedpublickey)
          VALUES ($1, $2, $3, $4, $5)
        `

      await writeClient.query(insertKeysQuery, [
        userId,
        publicKeyHex,
        deviceId,
        encryptedPrivateKey.CiphertextBlob.toString('base64'),
        encryptedPublicKey.CiphertextBlob.toString('base64'),
      ])

      const expiresAt = new Date(Date.now() + 2 * 7 * 24 * 60 * 60 * 1000)
      const created = new Date(Date.now())

      const session = await lucia.createSession(userId.toString(), {
        userId: userId,
        deviceId: deviceId,
        expiresAt,
        created,
      })

      sessionId = session.id
    } else {
      console.log('returning user!')
      const userId = hashResult.rows[0].userid
      const deviceId = hashResult.rows[0].deviceId

      console.log('DEVICE ID', deviceId)

      const expiresAt = new Date(Date.now() + 2 * 7 * 24 * 60 * 60 * 1000)
      const created = new Date(Date.now())

      const session = await lucia.createSession(userId.toString(), {
        userId: userId,
        deviceId: deviceId,
        expiresAt,
        created,
      })

      sessionId = session.id

      console.log({ userId, sessionId })
    }

    const sessionCookie = lucia.createSessionCookie(sessionId)
    console.log({ sessionCookie })

    const sessionCookieEndpoint = c.header(
      'Set-Cookie',
      sessionCookie.serialize(),
      { append: true },
    )
    console.log({ sessionCookieEndpoint })

    return c.json({
      success: true,
      userId,
      sessionId,
      deviceId,
    })
  } catch (error: unknown) {
    let errorMessage = 'An unknown error occurred'
    if (error instanceof Error) {
      errorMessage = error.message
    }
    return c.json({ success: false, message: errorMessage }, 500)
  }
})
