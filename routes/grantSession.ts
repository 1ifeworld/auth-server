import { alphabet, generateRandomString } from 'oslo/crypto'
import { app } from '../app'
import { authDb } from '../database/watcher'
import { custodyAddress, publicKey } from '../lib/keys'
import { selectDeviceQuery, insertKeysQuery } from '../lib/queries'
import { verifyMessage } from '../utils/signatures'
import { lucia } from '../lucia/auth'
import { base16 } from '@scure/base'

app.post('/grantSession', async (c) => {
  try {
    const { userId } = await c.req.json()

    console.log('Received',  userId)

    // Create new session for cases 1 and 2b
    const expiresAt = new Date(Date.now() + 2 * 7 * 24 * 60 * 60 * 1000)
    const deviceId = generateRandomString(10, alphabet('a-z', 'A-Z', '0-9', '-', '_'),
  )
    const created = new Date(Date.now())
    const session = await lucia.createSession(userId.toString(), {
      userId,
      deviceId,
      expiresAt,
      created,
    })

    const sessionCookie = lucia.createSessionCookie(session.id)
    console.log({ sessionCookie })
    c.header('Set-Cookie', sessionCookie.serialize(), { append: true })

    return c.json({
      success: true,
      sessionId: session.id,
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
