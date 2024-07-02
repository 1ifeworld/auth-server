import { alphabet, generateRandomString } from 'oslo/crypto'
import { authDb } from '../database/watcher'
import { custodyAddress, publicKey } from '../lib/keys'
import { selectDeviceQuery } from '../lib/queries'
import { verifyMessage } from '../lib/signatures'
import { lucia } from '../lucia/auth'
import { app } from '../server'

app.post('/provisionSession', async (c) => {
  try {
    const { deviceId, sessionId, siweMsg } = await c.req.json()

    console.log('Received', deviceId, sessionId, siweMsg)

    if (!siweMsg && !sessionId) {
      return c.json(
        { success: false, message: 'Missing SIWE message or session ID' },
        400,
      )
    }
    // double check user id type
    let userId: number

    let newDeviceId = deviceId

    // Case 1: No device ID (New User)
    if (!deviceId) {
      if (!siweMsg) {
        return c.json(
          { success: false, message: 'Missing SIWE message for new user' },
          400,
        )
      }

      const { message, signature } = siweMsg
      const isValid = verifyMessage(
        message,
        signature,
        Buffer.from(publicKey).toString('hex'),
      )
      if (!isValid) {
        return c.json({ success: false, message: 'Invalid signature' }, 400)
      }

      newDeviceId = generateRandomString(
        10,
        alphabet('a-z', 'A-Z', '0-9', '-', '_'),
      )
      userId = 10

      const insertKeysQuery = `
        INSERT INTO public.keys (userid, custodyAddress, deviceid)
        VALUES ($1, $2, $3)
      `
      await authDb.query(insertKeysQuery, [userId, custodyAddress, newDeviceId])
    }

    // Case 2: Device ID provided
    const deviceResult = await authDb.query(selectDeviceQuery, [deviceId])

    // Case 2a: Session token provided
    if (sessionId) {
      const { session } = await lucia.validateSession(sessionId)
      if (!session || session.deviceId !== deviceId) {
        return c.json({ success: false, message: 'Invalid session' }, 404)
      }
      return c.json({
        success: true,
        userId: deviceResult.rows[0].userid,
        sessionId: session.id,
        deviceId: deviceResult.rows[0].deviceid,
      })
    }

    // Case 2b: No session token, verify SIWE
    if (!siweMsg) {
      return c.json({ success: false, message: 'Missing SIWE message' }, 400)
    }

    const { message, signature } = siweMsg
    const isValid = verifyMessage(
      message,
      signature,
      Buffer.from(publicKey).toString('hex'),
    )
    if (!isValid) {
      return c.json({ success: false, message: 'Invalid signature' }, 400)
    }

    if (deviceResult.rows.length === 0) {
      newDeviceId = generateRandomString(
        10,
        alphabet('a-z', 'A-Z', '0-9', '-', '_'),
      )
      userId = 25 // Fixed user ID for new devices

      const insertKeysQuery = `
        INSERT INTO public.keys (userid, custodyAddress, deviceid)
        VALUES ($1, $2, $3)
      `
      await authDb.query(insertKeysQuery, [userId, custodyAddress, newDeviceId])
    } else {
      userId = deviceResult.rows[0].userid
    }

    // Create new session for cases 1 and 2b
    const expiresAt = new Date(Date.now() + 2 * 7 * 24 * 60 * 60 * 1000)
    const created = new Date(Date.now())
    const session = await lucia.createSession(userId.toString(), {
      userId,
      deviceId: newDeviceId,
      expiresAt,
      created,
    })

    const sessionCookie = lucia.createSessionCookie(session.id)
    console.log({ sessionCookie })
    c.header('Set-Cookie', sessionCookie.serialize(), { append: true })

    return c.json({
      success: true,
      userId,
      sessionId: session.id,
      deviceId: newDeviceId,
    })
  } catch (error: unknown) {
    let errorMessage = 'An unknown error occurred'
    if (error instanceof Error) {
      errorMessage = error.message
    }
    return c.json({ success: false, message: errorMessage }, 500)
  }
})
