import pg from "pg"
import { Hono } from "hono"
import { ed25519, ed25519ph} from "@noble/curves/ed25519"
import { blake3 } from "@noble/hashes/blake3"
import AWS from 'aws-sdk'
import { TextEncoder } from 'util'


const app = new Hono()

const { Client } = pg

const MESSAGE = JSON.stringify({ userId: "1", channelId: "9" })

const listenConnectionString = process.env.LISTEN_DATABASE_URL
const writeConnectionString = process.env.WRITE_DATABASE_URL



const KEY_REF = process.env.KEY_REF

if (!KEY_REF) {
  throw new Error("KEY_REF environment variable is not defined")
}

AWS.config.update({ region: 'us-east-1' })
const kms = new AWS.KMS()


const USER_ID_1_PRIV_KEY = process.env.USER_ID_1_PRIV_KEY
if (!USER_ID_1_PRIV_KEY) {
  throw new Error("USER_1_PRIVATE_KEY environment variable is not defined")
}

// Convert hex string to Uint8Array if necessary
const privKeyBytes = new Uint8Array(Buffer.from(USER_ID_1_PRIV_KEY, "hex"))
const USER_ID_1_PUB_KEY = ed25519.getPublicKey(USER_ID_1_PRIV_KEY)
// const pubKeyBytes = new Uint8Array(Buffer.from(USER_ID_1_PUB_KEY, "hex"))


const publicKey = ed25519.getPublicKey(privKeyBytes)
console.log({publicKey})
const custodyAddress = Buffer.from(publicKey).toString("hex")
console.log({custodyAddress})

const USER_ID = 1
const CHANNEL_ID = 9

type SignatureResponse = { sig: string, signer: string }

// Type guard function to check if the data matches the expected type
function isSignatureResponse(data: any): data is SignatureResponse {
  return (
    typeof data === "object" &&
    data !== null &&
    typeof data.sig === "string" &&
    typeof data.signer === "string"
  )
}

/**
 * Sign a message using the private key.
 * @param message The message to sign.
 * @returns The signature.
 */
function signMessage(message: string) {
  const msg = new TextEncoder().encode(message)
  const sig = ed25519.sign(msg, privKeyBytes)
  return Buffer.from(sig).toString('hex')
}

function signMessageWithKey(message: string, privateKey: Uint8Array): string {
  const msg = new TextEncoder().encode(message)
  const sig = ed25519.sign(msg, privateKey)
  return Buffer.from(sig).toString("hex")
}

/**
 * Verify a signed message using the public key.
 * @param message The original message.
 * @param signedMessage The signed message.
 * @param pubKey The public key used for verification.
 * @returns True if the signature is valid, false otherwise.
 */
export function verifyMessage(
  message: string,
  signedMessage: string,
  pubKey: string
): boolean {
  const msg = new TextEncoder().encode(message)
  const sig = Buffer.from(signedMessage, "hex")
  const pub = Buffer.from(pubKey, "hex")
  return ed25519.verify(sig, msg, pub)
}



const listenClient = new Client({
  connectionString: listenConnectionString,
})

const writeClient = new Client({
  connectionString: writeConnectionString,
})

listenClient
  .connect()
  .then(() => console.log("Connected to Source DB successfully"))
  .catch((err) =>
    console.error("Connection error with Source DB:", (err as Error).stack)
  )

writeClient
  .connect()
  .then(() => {
    console.log("Connected to Destination DB successfully")
    ensureTableExists()
  })
  .catch((err) =>
    console.error("Connection error with Destination DB:", (err as Error).stack)
  )

async function ensureTableExists() {
  try {
    await writeClient.query("BEGIN")
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS public.users (
          userid NUMERIC PRIMARY KEY,
          "to" BYTEA,
          recovery BYTEA,
          timestamp INT,
          log_addr BYTEA,
          block_num NUMERIC
        )
      `

  const createHashesTableQuery = `
      CREATE TABLE IF NOT EXISTS public.hashes (
        userid SERIAL PRIMARY KEY,
        custodyaddress TEXT,
        encryptedPublicKey BYTEA,
        encryptedPrivateKey BYTEA
      )
    `   
    await writeClient.query(createTableQuery)
    await writeClient.query(createHashesTableQuery)
    await writeClient.query("COMMIT")
    console.log("Schema and table verified/created successfully")
  } catch (err) {
    await writeClient.query("ROLLBACK")
    console.error("Error in schema/table creation in destination DB:", (err as Error).stack)
  }
}

async function checkAndReplicateData() {
  try {
    const maxBlockQueryResult = await writeClient.query(`
      SELECT COALESCE(MAX(block_num), 0) as max_block_number FROM public.users
    `)
    const lastProcessedBlockNumber = maxBlockQueryResult.rows[0].max_block_number

    const queryResult = await listenClient.query(
      `
      SELECT userid, "to", recovery, timestamp, log_addr, block_num FROM users
      WHERE block_num > $1
      ORDER BY block_num ASC
    `,
      [lastProcessedBlockNumber]
    )

    if (queryResult.rows.length > 0) {
      const res = await writeClient.query(
        `
  INSERT INTO public.users (userid, "to", recovery, timestamp, log_addr, block_num)
  SELECT * FROM unnest($1::NUMERIC[], $2::BYTEA[], $3::BYTEA[], $4::INT[], $5::BYTEA[], $6::NUMERIC[])
  ON CONFLICT (userid) DO UPDATE
  SET "to" = EXCLUDED."to", recovery = EXCLUDED.recovery, timestamp = EXCLUDED.timestamp, log_addr = EXCLUDED.log_addr, block_num = EXCLUDED.block_num
  RETURNING *
`,
        [
          queryResult.rows.map((row) => row.userid),
          queryResult.rows.map((row) => row.to),
          queryResult.rows.map((row) => row.recovery),
          queryResult.rows.map((row) => row.timestamp),
          queryResult.rows.map((row) => row.log_addr),
          queryResult.rows.map((row) => row.block_num),
        ]
      )
      console.log("Data replicated:", res.rows)
    }
  } catch (err) {
    console.error("Error during data replication", (err as Error).stack)
  }
}app.post("/signMessage", async (c) => {
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
      SELECT custodyAddress, encryptedPrivateKey, encryptedPublicKey
      FROM public.hashes
      WHERE userId = $1
    `
    const result = await writeClient.query(selectQuery, [userId])

    if (result.rows.length === 0) {
      return c.json({ success: false, message: "User not found" }, 404)
    }

    const { custodyAddress, encryptedPrivateKey, encryptedPublicKey } = result.rows[0]

    // Verify the signed message
    const isValid = verifyMessage(message, signedMessage, Buffer.from(publicKey).toString("hex"))
    if (!isValid) {
      return c.json({ success: false, message: "Invalid signature" }, 400)
    }

    // Decrypt the private key using AWS KMS
    const decryptedPrivateKey = await kms
      .decrypt({
        CiphertextBlob: encryptedPrivateKey,
      })
      .promise()

    // Decrypt the public key using AWS KMS
    const decryptedPublicKey = await kms
      .decrypt({
        CiphertextBlob: encryptedPublicKey,
      })
      .promise()

    // Check if decryption was successful
    if (!decryptedPrivateKey.Plaintext || !decryptedPublicKey.Plaintext) {
      throw new Error("Decryption failed")
    }

    // Sign the new message with the decrypted EDDSA private key
    const eddsaPrivateKey = new Uint8Array(decryptedPrivateKey.Plaintext as ArrayBuffer)
    const signedNewMessage = signMessageWithKey(newMessage, eddsaPrivateKey)

    // Re-encrypt the private key using AWS KMS
    const reEncryptedPrivateKey = await kms
      .encrypt({
        KeyId: KEY_REF,
        Plaintext: Buffer.from(eddsaPrivateKey),
      })
      .promise()

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
  // NOTE: MESSAGE constant defined at top of file
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

setInterval(checkAndReplicateData, 1000)

process.on("SIGINT", () => {
  Promise.all([listenClient.end(), writeClient.end()])
    .then(() => {
      console.log("Both clients disconnected")
      process.exit()
    })
    .catch((err) => console.error("Error during disconnection", (err as Error).stack))
})

app.get("/", (c) => c.text("Hello, Hono!"))

export { listenClient, writeClient }

Bun.serve({
  fetch: app.fetch,
  port: process.env.PORT || 3030,
})

console.log(`Hono server started on http://localhost:${process.env.PORT || 3030}`)