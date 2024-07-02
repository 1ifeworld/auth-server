import { blake3 } from '@noble/hashes/blake3'
import { messageDataToUint8Array } from '../buffers/buffers'
import { app } from '../app'


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
    const hash = await blake3(messageDataToUint8Array(messageData))

    return c.json({
      success: true,
      messageData,
      hash: hash,
    })
  } catch (error: unknown) {
    let errorMessage = 'An unknown error occurred'
    if (error instanceof Error) {
      errorMessage = error.message
    }
    return c.json({ success: false, message: errorMessage }, 500)
  }
})
