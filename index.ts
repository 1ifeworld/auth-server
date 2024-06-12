import { ed25519} from "@noble/curves/ed25519"
import { blake3 } from "@noble/hashes/blake3"
import { csrf } from 'hono/csrf'
import { getCookie } from "hono/cookie"
import { lucia } from "./sessions"
import { verifyRequestOrigin } from "lucia"
import { origin } from "bun"
import { app } from "./hono"
import { kms } from "./aws"
import { writeClient, listenClient } from "./watcher"
import { signMessage, signMessageWithKey, verifyMessage } from "./signatures"
import { KEY_REF, publicKey, custodyAddress } from "./keys"

verifyRequestOrigin(origin, [ "https://www.river.ph/*"])

// cross site request forgery helper 
app.use(csrf())

const MESSAGE = 'NADA' // placeholder message

app.use("*", async (c, next) => {
	const sessionId = getCookie(c, lucia.sessionCookieName) ?? null
	if (!sessionId) {
		c.set("user", null)
		c.set("session", null)
		return next()
	}
	const { session, user } = await lucia.validateSession(sessionId)
	if (session && session.fresh) {
		// use `header()` instead of `setCookie()` to avoid TS errors
		c.header("Set-Cookie", lucia.createSessionCookie(session.id).serialize(), {
			append: true
		})
	}
	if (!session) {
		c.header("Set-Cookie", lucia.createBlankSessionCookie().serialize(), {
			append: true
		})
	}
	c.set("user", user)
	c.set("session", session)
	return next()
})

app.get("/", async (c) => {
	const user = c.get("user")
	if (!user) {
		return c.body(null, 401)
	}

})


type SignatureResponse = { sig: string, signer: string }

function isSignatureResponse(data: any): data is SignatureResponse {
  return (
    typeof data === "object" &&
    data !== null &&
    typeof data.sig === "string" &&
    typeof data.signer === "string"
  )
}


app.post("/signMessage", async (c) => {
  try {
    const { message } = await c.req.json()

    if (!message) {
      return c.json({ success: false, message: "No message provided" }, 400)
    }

    const signedMessage = signMessage(message)

    return c.json({
      success: true,
      message,
      signedMessage,
    })
  } catch (error: unknown) {
    let errorMessage = "An unknown error occurred"
    if (error instanceof Error) {
      errorMessage = error.message
    }
    return c.json({ success: false, message: errorMessage }, 500)
  }
})

app.post("/signAndEncryptKeys", async (c) => {
  try {
    const { message, signedMessage } = await c.req.json()

    if (!message || !signedMessage) {
      return c.json({ success: false, message: "Missing parameters" }, 400)
    }

    // Verify the signed message
    const isValid = verifyMessage(message, signedMessage, Buffer.from(publicKey).toString("hex"))
    console.log(Buffer.from(publicKey).toString("hex"))
    console.log(isValid)
    if (!isValid) {
      return c.json({ success: false, message: "Invalid signature" }, 400)
    }

    // Generate EDDSA key pair
    const eddsaPrivateKey = ed25519.utils.randomPrivateKey()
    const eddsaPublicKey = ed25519.getPublicKey(eddsaPrivateKey)

    // Encrypt the EDDSA private key using AWS KMS
    const encryptedPrivateKey = await kms
      .encrypt({
        KeyId: KEY_REF,
        Plaintext: Buffer.from(eddsaPrivateKey),
      })
      .promise()

    // Encrypt the EDDSA public key using AWS KMS
    const encryptedPublicKey = await kms
      .encrypt({
        KeyId: KEY_REF,
        Plaintext: Buffer.from(eddsaPublicKey),
      })
      .promise()

    // Check if encryption was successful
    if (!encryptedPrivateKey.CiphertextBlob || !encryptedPublicKey.CiphertextBlob) {
      throw new Error("Encryption failed")
    }

    // Store encrypted keys in the database
    const insertQuery = `
      INSERT INTO public.hashes (custodyAddress, encryptedPrivateKey, encryptedPublicKey)
      VALUES ($1, $2, $3)
      RETURNING userId
    `
    const result = await writeClient.query(insertQuery, [
      custodyAddress,
      encryptedPrivateKey.CiphertextBlob,
      encryptedPublicKey.CiphertextBlob,
    ])
    const userId = result.rows[0].userid

    return c.json({
      success: true,
      userId,
      encryptedPrivateKey: encryptedPrivateKey.CiphertextBlob.toString("base64"),
      encryptedPublicKey: encryptedPublicKey.CiphertextBlob.toString("base64"),
    })
  } catch (error: unknown) {
    let errorMessage = "An unknown error occurred"
    if (error instanceof Error) {
      errorMessage = error.message
    }
    return c.json({ success: false, message: errorMessage }, 500)
  }
})

app.post("/signWithDecryptedKeys", async (c) => {
  try {
    const { userId, message, signedMessage, newMessage } = await c.req.json()

    if (!userId || !message || !signedMessage || !newMessage) {
      return c.json({ success: false, message: "Missing parameters" }, 400)
    }

    // Retrieve the stored encrypted keys
    const selectQuery = `
      SELECT encryptedprivatekey, encryptedpublickey
      FROM public.hashes
      WHERE userid = $1
    `
    const result = await writeClient.query(selectQuery, [userId])

    if (result.rows.length === 0) {
      return c.json({ success: false, message: "User not found" }, 404)
    }

    const { encryptedprivatekey, encryptedpublickey } = result.rows[0]

    // Verify the signed message
    const isValid = verifyMessage(
      message,
      signedMessage,
      Buffer.from(publicKey).toString("hex")
    )
    if (!isValid) {
      return c.json({ success: false, message: "Invalid signature" }, 400)
    }

    // Convert encrypted keys from base64 to buffers
    const encryptedPrivateKeyBuffer = Buffer.from(encryptedprivatekey, 'base64')
    const encryptedPublicKeyBuffer = Buffer.from(encryptedpublickey, 'base64')

    // Decrypt the private key using AWS KMS
    const decryptedPrivateKey = await kms.decrypt({
      CiphertextBlob: encryptedPrivateKeyBuffer,
    }).promise()

    // Decrypt the public key using AWS KMS
    const decryptedPublicKey = await kms.decrypt({
      CiphertextBlob: encryptedPublicKeyBuffer,
    }).promise()

    // Check if decryption was successful
    if (!decryptedPrivateKey.Plaintext || !decryptedPublicKey.Plaintext) {
      throw new Error("Decryption failed")
    }

    // Sign the new message with the decrypted EDDSA private key
    const eddsaPrivateKey = new Uint8Array(decryptedPrivateKey.Plaintext as ArrayBuffer)
    const signedNewMessage = signMessageWithKey(newMessage, eddsaPrivateKey)

    // Re-encrypt the private key using AWS KMS
    const reEncryptedPrivateKey = await kms.encrypt({
      KeyId: KEY_REF,
      Plaintext: Buffer.from(eddsaPrivateKey),
    }).promise()

    if (!reEncryptedPrivateKey.CiphertextBlob) {
      throw new Error("Re-encryption failed")
    }

    return c.json({
      success: true,
      signedNewMessage,
      reEncryptedPrivateKey: reEncryptedPrivateKey.CiphertextBlob.toString("base64"),
    })
  } catch (error: unknown) {
    let errorMessage = "An unknown error occurred"
    if (error instanceof Error) {
      errorMessage = error.message
    }
    return c.json({ success: false, message: errorMessage }, 500)
  }
})

app.get("/submitToChannel", async (c) => {
  try {
    // Request a signature from the KMS VM
    const response = await fetch(`https://240608-server-studies-production.up.railway.app/signMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: MESSAGE }),
    })

    if (!response.ok) {
      throw new Error("Failed to get signature from KMS")
    }

    const data: unknown = await response.json()

    if (!isSignatureResponse(data)) {
      throw new Error("KMS return invalid")
    }

    const { sig, signer } = data
    const isValid = verifyMessage(MESSAGE, sig, signer)

    if (isValid) {
      // Generate a BLAKE3 hash for submissionId
      //  const submissionId = blake3(new TextEncoder().encode(MESSAGE))
      const submissionId = blake3(MESSAGE)

      // Insert the new row into the submissions table
      const insertQuery = `
       INSERT INTO public.submissions (submissionId, submissionContents, submissionSig, submissionSigner)
       VALUES ($1, $2, $3, $4)
     `
      await writeClient.query(insertQuery, [
        submissionId,
        MESSAGE,
        sig,
        signer,
      ])

      return c.json({
        success: true,
        message: "Signature verified successfully",
        body: { submissionId, MESSAGE, sig, signer },
      })
    } else {
      return c.json({ success: false, message: "Failed to verify signature" })
    }
  } catch (error) {
    return c.json({ success: false, message: error })
  }
})

app.get("/", (c) => c.text("Hello, Hono!"))


Bun.serve({
  fetch: app.fetch,
  port: process.env.PORT || 3030,
})

console.log(`Hono server started on http://localhost:${process.env.PORT || 3030}`)