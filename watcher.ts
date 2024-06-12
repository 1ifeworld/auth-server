import pg from "pg"
import { app } from "./hono"

const { Client } = pg

const listenConnectionString = process.env.LISTEN_DATABASE_URL
const writeConnectionString = process.env.WRITE_DATABASE_URL

export const listenClient = new Client({
  connectionString: listenConnectionString,
})

export const writeClient = new Client({
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
    ensureTablesExist()
  })
  .catch((err) =>
    console.error("Connection error with Destination DB:", (err as Error).stack)
  )

async function ensureTablesExist() {
  try {
    await writeClient.query("BEGIN")

    // Create users table
    await writeClient.query(`
      CREATE TABLE IF NOT EXISTS public.users (
        id SERIAL PRIMARY KEY,
        "to" TEXT,
        recovery TEXT,
        timestamp TIMESTAMP,
        log_addr TEXT,
        block_num NUMERIC
      )
    `)

    // Create sessions table
    await writeClient.query(`
      CREATE TABLE IF NOT EXISTS public.sessions (
        id TEXT PRIMARY KEY,
        userId INTEGER NOT NULL REFERENCES public.users(id),
        session TEXT,
        created TIMESTAMP,
        expiresAt TIMESTAMP NOT NULL,
        deviceId TEXT NOT NULL
      )
    `)

    // Create hashes table
    await writeClient.query(`
      CREATE TABLE IF NOT EXISTS public.hashes (
        userId INTEGER NOT NULL REFERENCES public.users(id),
        custodyAddress TEXT NOT NULL,
        deviceId TEXT NOT NULL,
        encryptedpublickey TEXT NOT NULL,
        encryptedprivatekey TEXT NOT NULL,
        PRIMARY KEY (userId, custodyAddress, deviceId)
      )
    `)

    await writeClient.query("COMMIT")
    console.log("Schema and tables verified/created successfully")
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
      SELECT id, "to", recovery, timestamp, log_addr, block_num FROM users
      WHERE block_num > $1
      ORDER BY block_num ASC
    `,
      [lastProcessedBlockNumber]
    )

    if (queryResult.rows.length > 0) {
      const res = await writeClient.query(
        `
  INSERT INTO public.users (id, "to", recovery, timestamp, log_addr, block_num)
  SELECT * FROM unnest($1::NUMERIC[], $2::TEXT[], $3::TEXT[], $4::TIMESTAMP[], $5::TEXT[], $6::NUMERIC[])
  ON CONFLICT (id) DO UPDATE
  SET "to" = EXCLUDED."to", recovery = EXCLUDED.recovery, timestamp = EXCLUDED.timestamp, log_addr = EXCLUDED.log_addr, block_num = EXCLUDED.block_num
  RETURNING *
`,
        [
          queryResult.rows.map((row) => row.id),
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
}

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

Bun.serve({
  fetch: app.fetch,
  port: process.env.PORT || 3030,
})

console.log(`Hono server started on http://localhost:${process.env.PORT || 3030}`)
