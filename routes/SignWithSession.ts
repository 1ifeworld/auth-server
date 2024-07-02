// import { app } from '../server'
// import { kms } from '../clients/aws'
// import { authDb } from '../database/watcher'
// import { signMessageWithKey } from '../lib/signatures'
// import { lucia } from '../lucia/auth'
// import type { Message } from '../utils/types'
// import { selectKeysQuery, selectSessionQuery } from '../lib/queries'
// import { makeCid } from '../utils/helpers'
// import { isMessage } from '../utils/types'

// // opinionated message types

// app.post('/signMessage', async (c) => {
//   try {
//     const { sessionId, message } = await c.req.json()

//     if (!sessionId || !message) {
//       return c.json({ success: false, message: 'Missing parameters' }, 400)
//     }

//     if (!isMessage(message)) {
//       return c.json({ success: false, message: 'Invalid message format' }, 400)
//     }

//     const { session, user } = await lucia.validateSession(sessionId)

//     if (!session) {
//       return c.json({ success: false, message: 'Invalid session' }, 404)
//     }

//     const sessionResult = await authDb.query(selectSessionQuery, [sessionId])

//     const { userid } = sessionResult.rows[0]

//     if (userid !== message.messageData.rid) {
//       return
//     }
//     const keysResult = await authDb.query(selectKeysQuery, [userid])

//     if (keysResult.rows.length === 0) {
//       return c.json({ success: false, message: 'Keys not found' }, 404)
//     }

//     const { encryptedprivatekey, publickey } = keysResult.rows[0]

//     const computedCid = await makeCid(message.messageData)

//     console.log({ computedCid })
//     console.log({ messagehash: message.hash.toString() })

//     if (computedCid.toString() !== message.hash.toString()) {
//       return c.json({ success: false, message: 'Invalid message hash' }, 400)
//     }

//     // Decrypt the private key using AWS KMS
//     const decryptedPrivateKey = await kms
//       .decrypt({
//         CiphertextBlob: Buffer.from(encryptedprivatekey, 'base64'),
//       })
//       .promise()

//     if (!decryptedPrivateKey.Plaintext) {
//       throw new Error('Decryption failed')
//     }
//     const eddsaPrivateKey = new Uint8Array(
//       decryptedPrivateKey.Plaintext as ArrayBuffer,
//     )
//     const signature = signMessageWithKey(
//       message.hash.toString(),
//       eddsaPrivateKey,
//     )

//     const signedMessage: Message = {
//       ...message,
//       signer: publickey,
//       sigType: 1,
//       // sig: new Uint8Array(Buffer.from(signature)),
//       sig: signature,

//     }

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
