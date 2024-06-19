import { signMessage } from '../lib/signatures'
import { app } from '../server'

type SignatureResponse = { sig: string; signer: string }

function isSignatureResponse(data: any): data is SignatureResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof data.sig === 'string' &&
    typeof data.signer === 'string'
  )
}

app.post('/sign', async (c) => {
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
