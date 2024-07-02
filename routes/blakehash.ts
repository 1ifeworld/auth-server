// import { blake3 } from '@noble/hashes/blake3'
// import { app } from '../server'

// app.post('/makeBlake', async (c) => {
//     console.log('route hit')
//     try {
//       const { messageData } = await c.req.json()
  
//       if (!messageData || typeof messageData !== 'object') {
//         return c.json(
//           { success: false, message: 'Invalid or missing messageData' },
//           400,
//         )
//       }
  
//       const messageBytes = new Uint8Array(Buffer.from(messageData))

//       const hash = await blake3(messageBytes)
//       console.log({hash})
//       console.log({hash: hash.toString()})
  
//       return c.json({
//         success: true,
//         messageData,
//         cid: hash.toString(),
//       })
//     } catch (error: unknown) {
//       let errorMessage = 'An unknown error occurred'
//       if (error instanceof Error) {
//         errorMessage = error.message
//       }
//       return c.json({ success: false, message: errorMessage }, 500)
//     }
//   })
  