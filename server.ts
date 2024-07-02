import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import { csrf } from 'hono/csrf'
import type { Session, User } from 'lucia'
import { lucia } from './lucia/auth'
import { cors } from 'hono/cors'
import { makeCid } from './utils/helpers'
import { kms } from './clients/aws'
import { authDb } from './database/watcher'
import { signMessageWithKey } from './lib/signatures'
import type { Message } from './utils/types'
import { selectKeysQuery, selectSessionQuery, selectDeviceQuery } from './lib/queries'
import { isMessage } from './utils/types'
import { blake3 } from '@noble/hashes/blake3'
import { base64 } from '@scure/base'
import { ed25519 } from '@noble/curves/ed25519'
import {
  alphabet,
  generateRandomInteger,
  generateRandomString,
} from 'oslo/crypto'
import { KEY_REF } from './lib/keys'
import { custodyAddress, publicKey } from './lib/keys'
import { verifyMessage } from './lib/signatures'
import type { Hex } from '@noble/curves/abstract/utils'
import { app } from '.'

export interface AuthReq {
  deviceId: string
  sessionId: string
  siweMsg: {
    custodyAddress: Hex
    message: string
    signature: Uint8Array
  }
}


// Cross Site Request Forgery (CSRF) protection middleware
// app.use(csrf())

// // CORS middleware
// app.use(
//   '*',
//   cors({
//     origin: 'http://localhost:8081',
//     allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
//     allowHeaders: ['Content-Type', 'Authorization'],
//     exposeHeaders: ['Content-Length'],
//     maxAge: 600,
//     credentials: true,
//   }),
// )

// Session and user handling middleware
// app.use('*', async (c, next) => {
//   const sessionId = getCookie(c, lucia.sessionCookieName) ?? null
//   console.log('Session ID:', sessionId)

//   if (!sessionId) {
//     c.set('user', null)
//     c.set('session', null)
//     console.log('No session ID found, setting user and session to null')
//     return next()
//   }

//   const { session, user } = await lucia.validateSession(sessionId)

//   console.log('Validated Session:', session)
//   if (session && session.fresh) {
//     c.header('Set-Cookie', lucia.createSessionCookie(session.id).serialize(), {
//       append: true,
//     })
//     console.log('Session is fresh, setting session cookie')
//   } else if (!session) {
//     c.header('Set-Cookie', lucia.createBlankSessionCookie().serialize(), {
//       append: true,
//     })
//     console.log('No valid session found, setting blank session cookie')
//   }

//   c.set('user', user)
//   c.set('session', session)
//   return next()
// })

// Example route (uncomment and customize as needed)
// app.get('/', async (c) => {
//   const user = c.get('user')
//   const session = c.get('session')

//   console.log('Got session at main route:', session)
//   if (!user) {
//     return c.body(null, 401)
//   }
//   return c.body({ message: 'Hello, authenticated user!' })
// })

app.get('/', async (c) => {
  console.log('YIO')
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Welcome</title>
    </head>
    <body>
      <h1>Welcome to the Hono Server</h1>
      <p>This is the root route. Your server is running correctly.</p>
    </body>
    </html>
  `
  return c.html(htmlContent)
})

app.post('/generateCid', async (c) => {
  console.log('route hit')
  try {
    const { messageData } = await c.req.json()

    if (!messageData || typeof messageData !== 'object') {
      return c.json(
        { success: false, message: 'Invalid or missing messageData' },
        400,
      )
    }

    const cid = await makeCid(messageData)

    return c.json({
      success: true,
      messageData,
      cid: cid.toString(),
    })
  } catch (error: unknown) {
    let errorMessage = 'An unknown error occurred'
    if (error instanceof Error) {
      errorMessage = error.message
    }
    return c.json({ success: false, message: errorMessage }, 500)
  }
})

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

    const computedHash = blake3(JSON.stringify(message.messageData))
    const computedHashBase64 = base64.encode(computedHash)



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

app.post('/makeBlake', async (c) => {
    console.log('route hit')
    try {
      const { messageData } = await c.req.json()
  
      if (!messageData || typeof messageData !== 'object') {
        return c.json(
          { success: false, message: 'Invalid or missing messageData' },
          400,
        )
      }
      // HUGE IMPORTANT FLAG THAT WE'RE STRINGIFYING THE MESSAGE DATA OBJECTTTTT
      const hash = await blake3(JSON.stringify(messageData))
      const hashBase64 = base64.encode(hash)
      console.log({ hashBase64 })
    
      return c.json({
        success: true,
        messageData,
        hash: hashBase64,
      })
      
    } catch (error: unknown) {
      let errorMessage = 'An unknown error occurred'
      if (error instanceof Error) {
        errorMessage = error.message
      }
      return c.json({ success: false, message: errorMessage }, 500)
    }
  })

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
  
      let userId
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
      else {
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
        else {
          if (!siweMsg) {
            return c.json(
              { success: false, message: 'Missing SIWE message' },
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
            await authDb.query(insertKeysQuery, [
              userId,
              custodyAddress,
              newDeviceId,
            ])
          } else {
            userId = deviceResult.rows[0].userid
          }
        }
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
        SELECT userid FROM public.keys
        WHERE custodyAddress = $1
      `
    const hashResult = await authDb.query(selectHashQuery, [publicKeyHex])

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

      if (!encryptedPrivateKey.CiphertextBlob || !eddsaPublicKey.toString()) {
        throw new Error('Encryption failed')
      }

      console.log('prestorekeys', { userId, publicKeyHex })

      const insertKeysQuery = `
          INSERT INTO public.keys (userid, custodyAddress, deviceid, encryptedprivatekey, publickey)
          VALUES ($1, $2, $3, $4, $5)
        `

      await authDb.query(insertKeysQuery, [
        userId,
        publicKeyHex,
        deviceId,
        encryptedPrivateKey.CiphertextBlob.toString('base64'),
        Buffer.from(eddsaPublicKey).toString('hex'),
      ])

      console.log({ encrypted: eddsaPublicKey.toString() })

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
  
  

export default {
  // port: 3000,
  fetch: app.fetch,
}


