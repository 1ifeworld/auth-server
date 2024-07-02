import { app } from '../server'
import { makeCid } from '../utils/helpers'
import type {  } from '../utils/types'

app.post('/generateCid', async (c) => {
  try {
    const { messageData } = await c.req.json()

    if (!messageData || typeof messageData !== 'object') {
      return c.json({ success: false, message: 'Invalid or missing messageData' }, 400)
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
