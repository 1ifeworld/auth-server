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
import { selectKeysQuery, selectSessionQuery } from './lib/queries'
import { isMessage } from './utils/types'
import { blake3 } from '@noble/hashes/blake3'
import { base64 } from '@scure/base'

export const app = new Hono<{
  Variables: {
    user: User | null
    session: Session | null
  }
}>()

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
    const signer = Buffer.from(publickey).toString('hex')

    const signedMessage: Message = {
      signer: signer,
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
  

export default {
  port: 3000,
  fetch: app.fetch,
}

import './routes'
