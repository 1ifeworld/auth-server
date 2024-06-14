// import { ed25519 } from '@noble/curves/ed25519'
// import { blake3 } from '@noble/hashes/blake3'
// import { randomBytes } from '@noble/hashes/utils'
// import { origin } from 'bun'
// import { getCookie } from 'hono/cookie'
// import { csrf } from 'hono/csrf'
// import { verifyRequestOrigin } from 'lucia'
// import { generateRandomInteger, generateRandomString } from 'oslo/crypto'
// import { kms } from './aws'
// import { app } from './hono'
// import { KEY_REF, publicKey } from './keys'
// import { lucia } from './sessions'
// import { signMessage, signMessageWithKey, verifyMessage } from './signatures'
// import { writeClient } from './watcher'

// // verifyRequestOrigin(origin, ["https://www.river.ph/*"])

// // // cross site request forgery helper
// app.use(csrf())
// console.log("after app.use")

// const MESSAGE = 'NADA' // placeholder message

// app.use("*", async (c, next) => {
//   const id = getCookie(c, lucia.sessionCookieName) ?? null
//   if (!id) {
//     c.set("user", null)
//     c.set("session", null)
//     return next()
//   }
//   const { session, user } = await lucia.validateSession(id)
//   if (session && session.fresh) {
//     c.header("Set-Cookie", lucia.createSessionCookie(session.id).serialize(), {
//       append: true,
//     })
//   }
//   if (!session) {
//     c.header("Set-Cookie", lucia.createBlankSessionCookie().serialize(), {
//       append: true,
//     })
//   }
//   c.set("user", user)
//   console.log({user})
//   c.set("session", session)
//   console.log({session})
//   return next()
// })

// console.log("post app * * *")

// app.get('/', async (c) => {
//   const user = c.get('user')
//   console.log({inget: user})
//   if (!user) {
//     return c.body(null, 401)
//   }
// })

// console.log("post ////")

// type SignatureResponse = { sig: string, signer: string }

// function isSignatureResponse(data: any): data is SignatureResponse {
//   return (
//     typeof data === 'object' &&
//     data !== null &&
//     typeof data.sig === 'string' &&
//     typeof data.signer === 'string'
//   )
// }

// app.post('/signMessage', async (c) => {
//   try {
//     const { message } = await c.req.json()

//     if (!message) {
//       return c.json({ success: false, message: 'No message provided' }, 400)
//     }

//     const signedMessage = signMessage(message)

//     return c.json({
//       success: true,
//       message,
//       signedMessage,
//     })
//   } catch (error: unknown) {
//     let errorMessage = 'An unknown error occurred'
//     if (error instanceof Error) {
//       errorMessage = error.message
//     }
//     return c.json({ success: false, message: errorMessage }, 500)
//   }
// })

// app.post('/generateEncryptKeysAndSessionId', async (c) => {
//   console.log('IN ENCRYPT ROUTE')
//   try {
//     const { message, signedMessage, deviceId } = await c.req.json()

//     if (!message || !signedMessage || !deviceId) {
//       return c.json({ success: false, message: 'Missing parameters' }, 400)
//     }

//     // Verify the signed message
//     const isValid = verifyMessage(
//       message,
//       signedMessage,
//       Buffer.from(publicKey).toString('hex'),
//     )
//     if (!isValid) {
//       return c.json({ success: false, message: 'Invalid signature' }, 400)
//     }

//     console.log({ isValid })

//     const publicKeyHex = Buffer.from(publicKey).toString('hex')

//     // Check if a custody address exists in the hashes table
//     const selectHashQuery = `
//       SELECT userid FROM public.hashes
//       WHERE custodyAddress = $1
//     `
//     const hashResult = await writeClient.query(selectHashQuery, [publicKeyHex])

//     console.log({ hashResult })
//     const userId = generateRandomInteger(100)
//     let sessionId

//     if (hashResult.rows.length === 0) {
//       console.log('first time user!')
//       // First-time user - generate keys, encrypt, and store them
//       const eddsaPrivateKey = ed25519.utils.randomPrivateKey()
//       const eddsaPublicKey = ed25519.getPublicKey(eddsaPrivateKey)

//       const encryptedPrivateKey = await kms
//         .encrypt({
//           KeyId: KEY_REF,
//           Plaintext: Buffer.from(eddsaPrivateKey),
//         })
//         .promise()

//       const encryptedPublicKey = await kms
//         .encrypt({
//           KeyId: KEY_REF,
//           Plaintext: Buffer.from(eddsaPublicKey),
//         })
//         .promise()

//       if (
//         !encryptedPrivateKey.CiphertextBlob ||
//         !encryptedPublicKey.CiphertextBlob
//       ) {
//         throw new Error('Encryption failed')
//       }

//       // Store the encrypted keys
//       console.log('prestorekeys')
//       const insertKeysQuery = `
//         INSERT INTO public.hashes (userid, custodyAddress, deviceid, encryptedprivatekey, encryptedpublickey)
//         VALUES ($1, $2, $3, $4, $5)
//       `

//       await writeClient.query(insertKeysQuery, [
//         userId,
//         publicKeyHex,
//         deviceId,
//         encryptedPrivateKey.CiphertextBlob.toString('base64'),
//         encryptedPublicKey.CiphertextBlob.toString('base64'),
//       ])

//       const expiresAt = new Date(Date.now() + 2 * 7 * 24 * 60 * 60 * 1000)

//       // Create a session with Lucia
//       const session = await lucia.createSession(userId.toString(), { userId: userId.toString(), expiresAt, deviceId })
//       sessionId = session.id
//     } else {
//       console.log('returning user!')
//       // Returning user - update session
//       const userId = hashResult.rows[0].userid

//       const expiresAt = new Date(Date.now() + 2 * 7 * 24 * 60 * 60 * 1000)
//       const session = await lucia.createSession(userId.toString(), { userId: userId.toString(), expiresAt, deviceId })
//       sessionId = session.id

//       console.log({ userId, sessionId })
//     }

//     // Create session cookie
//     const sessionCookie = lucia.createSessionCookie(sessionId)
//     console.log({sessionCookie})

//     c.header("Set-Cookie", sessionCookie.serialize(), { append: true })

//     return c.json({
//       success: true,
//       userId,
//       sessionId,
//     })
//   } catch (error: unknown) {
//     let errorMessage = 'An unknown error occurred'
//     if (error instanceof Error) {
//       errorMessage = error.message
//     }
//     return c.json({ success: false, message: errorMessage }, 500)
//   }
// })



// app.post('/signMessageWithSession', async (c) => {
//   try {
//     const { sessionId, message } = await c.req.json()

//     if (!sessionId || !message) {
//       return c.json({ success: false, message: 'Missing parameters' }, 400)
//     }

//     // Retrieve the session and associated user
//     const selectSessionQuery = `
//       SELECT s.userid, h.custodyAddress FROM public.sessions s
//       JOIN public.hashes h ON s.userid = h.userid
//       WHERE s.id = $1
//     `
//     const sessionResult = await writeClient.query(selectSessionQuery, [
//       sessionId,
//     ])
//     console.log({ sessionResult })

//     if (sessionResult.rows.length === 0) {
//       return c.json({ success: false, message: 'Invalid session' }, 404)
//     }

//     const { userid } = sessionResult.rows[0]

//     // Retrieve the stored encrypted keys
//     const selectKeysQuery = `
//       SELECT encryptedprivatekey FROM public.hashes
//       WHERE userid = $1
//     `
//     const keysResult = await writeClient.query(selectKeysQuery, [userid])

//     if (keysResult.rows.length === 0) {
//       return c.json({ success: false, message: 'Keys not found' }, 404)
//     }

//     const { encryptedprivatekey } = keysResult.rows[0]

//     // Decrypt the private key using AWS KMS
//     const decryptedPrivateKey = await kms
//       .decrypt({
//         CiphertextBlob: Buffer.from(encryptedprivatekey, 'base64'),
//       })
//       .promise()

//     if (!decryptedPrivateKey.Plaintext) {
//       throw new Error('Decryption failed')
//     }

//     // Sign the message with the decrypted EDDSA private key
//     const eddsaPrivateKey = new Uint8Array(
//       decryptedPrivateKey.Plaintext as ArrayBuffer,
//     )
//     const signedMessage = signMessageWithKey(message, eddsaPrivateKey)

//     // Re-encrypt the private key using AWS KMS
//     const reEncryptedPrivateKey = await kms
//       .encrypt({
//         KeyId: KEY_REF,
//         Plaintext: Buffer.from(eddsaPrivateKey),
//       })
//       .promise()

//     if (!reEncryptedPrivateKey.CiphertextBlob) {
//       throw new Error('Re-encryption failed')
//     }

//     const updateKeysQuery = `
//     UPDATE public.hashes
//     SET encryptedprivatekey = $1
//     WHERE userid = $2
//   `
//   await writeClient.query(updateKeysQuery, [
//     reEncryptedPrivateKey.CiphertextBlob.toString('base64'),
//     userid,
//   ])

//     return c.json({
//       success: true,
//       signedMessage,
//     })
//   } catch (error: unknown) {
//     let errorMessage = 'An unknown error occurred'
//     if (error instanceof Error) {
//       errorMessage = error.message
//     }
//     return c.json({ success: false, message: errorMessage }, 500)
//   }
// })

// app.get('/submitToChannel', async (c) => {
//   try {
//     // Request a signature from the KMS VM
//     const response = await fetch(
//       `https://240608-server-studies-production.up.railway.app/signMessage`,
//       {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ message: MESSAGE }),
//       },
//     )

//     if (!response.ok) {
//       throw new Error('Failed to get signature from KMS')
//     }

//     const data: unknown = await response.json()

//     if (!isSignatureResponse(data)) {
//       throw new Error('KMS return invalid')
//     }

//     const { sig, signer } = data
//     const isValid = verifyMessage(MESSAGE, sig, signer)

//     if (isValid) {
//       // Generate a BLAKE3 hash for submissionId
//       const submissionId = blake3(new TextEncoder().encode(MESSAGE))

//       // Insert the new row into the submissions table
//       const insertQuery = `
//        INSERT INTO public.submissions (submissionId, submissionContents, submissionSig, submissionSigner)
//        VALUES ($1, $2, $3, $4)
//      `
//       await writeClient.query(insertQuery, [submissionId, MESSAGE, sig, signer])

//       return c.json({
//         success: true,
//         message: 'Signature verified successfully',
//         body: { submissionId, MESSAGE, sig, signer },
//       })
//     } else {
//       return c.json({ success: false, message: 'Failed to verify signature' })
//     }
//   } catch (error) {
//     return c.json({ success: false, message: error })
//   }
// })

// Bun.serve({
//   fetch: app.fetch,
//   port: process.env.PORT || 3030,
// })

// console.log("served")
// console.log(
//   `Hono server started on http://localhost:${process.env.PORT || 3030}`,
// )



import { ed25519 } from '@noble/curves/ed25519'
import { blake3 } from '@noble/hashes/blake3'
import { randomBytes } from '@noble/hashes/utils'
import { origin } from 'bun'
import { getCookie } from 'hono/cookie'
import { csrf } from 'hono/csrf'
import { verifyRequestOrigin } from 'lucia'
import { generateRandomInteger, generateRandomString } from 'oslo/crypto'
import { kms } from './aws'
import { app } from './hono'
import { KEY_REF, publicKey } from './keys'
import { lucia } from './sessions'
import { signMessage, signMessageWithKey, verifyMessage } from './signatures'
import { writeClient } from './watcher'

// verifyRequestOrigin(origin, ["https://www.river.ph/*"])

// // cross site request forgery helper
app.use(csrf())

const MESSAGE = 'NADA' // placeholder message

// app.use("*", async (c, next) => {
//   console.log("YO WERE HERE")
//   const id = getCookie(c, lucia.sessionCookieName) ?? null
//   if (!id) {
//     c.set("user", null)
//     c.set("session", null)
//     return next()
//   }
//   console.log("session chexx")
//   const { session, user } = await lucia.validateSession(id)
//   console.log("sessionpost")
//   if (session && session.fresh) {
//     c.header("Set-Cookie", lucia.createSessionCookie(session.id).serialize(), {
//       append: true,
//     })
//   }
//   if (!session) {
//     c.header("Set-Cookie", lucia.createBlankSessionCookie().serialize(), {
//       append: true,
//     })
//   }
//   c.set("user", user)
//   c.set("session", session)
//   return next()
// })

app.get('/', async (c) => {
  const user = c.get('user')
  if (!user) {
    return c.body(null, 401)
  }
})

type SignatureResponse = { sig: string; signer: string }

function isSignatureResponse(data: any): data is SignatureResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof data.sig === 'string' &&
    typeof data.signer === 'string'
  )
}

app.post('/signMessage', async (c) => {
  try {
    const { message } = await c.req.json()

    if (!message) {
      return c.json({ success: false, message: 'No message provided' }, 400)
    }

    const signedMessage = signMessage(message)

    return c.json({
      success: true,
      message,
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

app.post('/generateEncryptKeysAndSessionId', async (c) => {
  console.log('IN ENCRYPT ROUTE')
  try {
    const { message, signedMessage, deviceId } = await c.req.json()

    if (!message || !signedMessage || !deviceId) {
      return c.json({ success: false, message: 'Missing parameters' }, 400)
    }

    // Verify the signed message
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

    // Check if a custody address exists in the hashes table
    const selectHashQuery = `
      SELECT userid FROM public.hashes
      WHERE custodyAddress = $1
    `
    const hashResult = await writeClient.query(selectHashQuery, [publicKeyHex])

    console.log({ hashResult })
    const userId = generateRandomInteger(100)
    let sessionId

    if (hashResult.rows.length === 0) {
      console.log('first time user!')
      // First-time user - generate keys, encrypt, and store them
      const eddsaPrivateKey = ed25519.utils.randomPrivateKey()
      const eddsaPublicKey = ed25519.getPublicKey(eddsaPrivateKey)

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

      // Store the encrypted keys
      console.log('prestorekeys')
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

      // Create a session with Lucia
      const session = await lucia.createSession(userId.toString(), { userId: userId.toString(), expiresAt, deviceId })

      sessionId = session.id
    } else {
      console.log('returning user!')
      // Returning user - update session
      const userId = hashResult.rows[0].userid

      const expiresAt = new Date(Date.now() + 2 * 7 * 24 * 60 * 60 * 1000)
      const session = await lucia.createSession(userId.toString(), { userId: userId.toString(), expiresAt, deviceId })

      sessionId = session.id

      console.log({ userId, sessionId })
    }

    // Create session cookie
    const sessionCookie = lucia.createSessionCookie(sessionId)
    console.log({sessionCookie})

    c.header("Set-Cookie", sessionCookie.serialize(), { append: true })

    return c.json({
      success: true,
      userId,
      sessionId,
    })
  } catch (error: unknown) {
    let errorMessage = 'An unknown error occurred'
    if (error instanceof Error) {
      errorMessage = error.message
    }
    return c.json({ success: false, message: errorMessage }, 500)
  }
})

app.post('/signMessageWithSession', async (c) => {
  try {
    const { sessionId, message } = await c.req.json()

    if (!sessionId || !message) {
      return c.json({ success: false, message: 'Missing parameters' }, 400)
    }

    // Retrieve the session and associated user
    const selectSessionQuery = `
      SELECT s.userid, h.custodyAddress FROM public.sessions s
      JOIN public.hashes h ON s.userid = h.userid
      WHERE s.id = $1
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

app.get('/submitToChannel', async (c) => {
  try {
    // Request a signature from the KMS VM
    const response = await fetch(
      `https://240608-server-studies-production.up.railway.app/signMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: MESSAGE }),
      },
    )

    if (!response.ok) {
      throw new Error('Failed to get signature from KMS')
    }

    const data: unknown = await response.json()

    if (!isSignatureResponse(data)) {
      throw new Error('KMS return invalid')
    }

    const { sig, signer } = data
    const isValid = verifyMessage(MESSAGE, sig, signer)

    if (isValid) {
      // Generate a BLAKE3 hash for submissionId
      const submissionId = blake3(new TextEncoder().encode(MESSAGE))

      // Insert the new row into the submissions table
      const insertQuery = `
       INSERT INTO public.submissions (submissionId, submissionContents, submissionSig, submissionSigner)
       VALUES ($1, $2, $3, $4)
     `
      await writeClient.query(insertQuery, [submissionId, MESSAGE, sig, signer])

      return c.json({
        success: true,
        message: 'Signature verified successfully',
        body: { submissionId, MESSAGE, sig, signer },
      })
    } else {
      return c.json({ success: false, message: 'Failed to verify signature' })
    }
  } catch (error) {
    return c.json({ success: false, message: error })
  }
})

Bun.serve({
  fetch: app.fetch,
  port: process.env.PORT || 3030,
})

console.log(
  `Hono server started on http://localhost:${process.env.PORT || 3030}`,
)