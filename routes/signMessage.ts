// src/routes/signMessageRoutes.ts

import { Hono } from 'hono'
import { signMessage } from '../signatures'

export const signMessageRoute = new Hono()

type SignatureResponse = { sig: string, signer: string }

function isSignatureResponse(data: any): data is SignatureResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof data.sig === 'string' &&
    typeof data.signer === 'string'
  )
}

signMessageRoute.post('/signMessage', async (c) => {
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
