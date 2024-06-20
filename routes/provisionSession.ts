import { ed25519 } from '@noble/curves/ed25519'
import { alphabet, generateRandomString } from 'oslo/crypto'
import { kms } from '../clients/aws'
import { writeClient } from '../database/watcher'
import { KEY_REF, custodyAddress, publicKey } from '../lib/keys'
import { verifyMessage } from '../lib/signatures'
import { lucia } from '../lucia/auth'
import { app } from '../server'
import type { Hex } from '@noble/curves/abstract/utils'

export interface AuthReq {
  deviceId: String
  sessionId: String
  SIWEMsg: {
    custodyAddress: Hex
    message: string
    signature: Uint8Array
  }
}

app.post('/provisionSession', async (c) => {
  try {
    const { deviceId, sessionId, SIWEMsg } = await c.req.json()

    if (!deviceId || !SIWEMsg) {
      return c.json({ success: false, message: 'Missing parameters' }, 400)
    }

    const { message, signature } = SIWEMsg

    const selectDeviceQuery = `SELECT userid, deviceid FROM public.hashes WHERE custodyAddress = $1`
    const deviceResult = await writeClient.query(selectDeviceQuery, [deviceId])

    let userId

    if (deviceResult.rows.length > 0) {
      console.log('Device exists in hashes table')

      const isValid = verifyMessage(
        message,
        signature,
        Buffer.from(publicKey).toString('hex'),
      )
      if (!isValid) {
        return c.json({ success: false, message: 'Invalid signature' }, 400)
      }

      if (sessionId) {
        const { session } = await lucia.validateSession(sessionId)

        if (!session) {
          return c.json({ success: false, message: 'Invalid session' }, 404)
        }
        if (session) {
          return c.json({
            success: true,
            userId: deviceResult.rows[0].userid,
            sessionId: session.id,
            deviceId: deviceResult.rows[0].deviceid,
          })
        }
      }
    } else {
      console.log('Device does not exist in hashes table')
      const isValid = verifyMessage(
        message,
        signature,
        Buffer.from(publicKey).toString('hex'),
      )

      if (!isValid) {
        return c.json({ success: false, message: 'Invalid signature' }, 400)
      }

      const newDeviceId = generateRandomString(
        10,
        alphabet('a-z', 'A-Z', '0-9', '-', '_'),
      )

      userId = 25

      const insertKeysQuery = `
        INSERT INTO public.hashes (userid, custodyAddress, deviceid)
        VALUES ($1, $2, $3)
      `

      await writeClient.query(insertKeysQuery, [
        userId,
        custodyAddress,
        newDeviceId,
      ])

      const expiresAt = new Date(Date.now() + 2 * 7 * 24 * 60 * 60 * 1000)
      const created = new Date(Date.now())

      const session = await lucia.createSession(userId.toString(), {
        userId,
        deviceId: newDeviceId,
        expiresAt,
        created,
      })

      const sessionCookie = lucia.createSessionCookie(session.id)
      c.header('Set-Cookie', sessionCookie.serialize(), { append: true })

      return c.json({
        success: true,
        userId,
        sessionId: session.id,
        deviceId: newDeviceId,
      })
    }

    const sessionCookie = lucia.createSessionCookie(sessionId)
    c.header('Set-Cookie', sessionCookie.serialize(), { append: true })

  } catch (error: unknown) {
    let errorMessage = 'An unknown error occurred'
    if (error instanceof Error) {
      errorMessage = error.message
    }
    return c.json({ success: false, message: errorMessage }, 500)
  }
})
