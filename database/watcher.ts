import pg from 'pg'

const { Client } = pg

const listenConnectionString = process.env.LISTEN_DATABASE_URL!
const authConnectionString = process.env.WRITE_DATABASE_URL!

export const listenClient = new Client({
  connectionString: listenConnectionString,
})

export const authDb = new Client({
  connectionString: authConnectionString,
})

listenClient
  .connect()
  .then(() => console.log('Connected to Source DB successfully'))
  .catch((err) =>
    console.error('Connection error with Source DB:', (err as Error).stack),
  )

console.log({ listenClient })

authDb
  .connect()
  .then(() => {
    console.log('Connected to Destination DB successfully')
    ensureTablesExist()
  })
  .catch((err) =>
    console.error(
      'Connection error with Destination DB:',
      (err as Error).stack,
    ),
  )

console.log({ authDb })

async function ensureTablesExist() {
  try {
    await authDb.query('BEGIN')

    // Create users table
    await authDb.query(`
      CREATE TABLE IF NOT EXISTS public.users (
        userid NUMERIC PRIMARY KEY,
        "to" TEXT,
        recovery TEXT,
        timestamp NUMERIC,
        log_addr TEXT,
        block_num NUMERIC
      )
    `)

    // Create sessions table
    await authDb.query(`
      CREATE TABLE IF NOT EXISTS public.sessions (
        id TEXT PRIMARY KEY,
        userid NUMERIC NOT NULL REFERENCES public.users(userid),
        deviceid TEXT NOT NULL,
        created TIMESTAMP,
        expiresAt TIMESTAMP NOT NULL
      )
    `)

    // Create keys table
    await authDb.query(`
      CREATE TABLE IF NOT EXISTS public.keys (
        userid NUMERIC NOT NULL REFERENCES public.users(userid),
        custodyaddress TEXT NOT NULL,
        deviceid TEXT NOT NULL,
        publickey TEXT NOT NULL,
        encryptedprivatekey TEXT NOT NULL,
        timestamp NUMERIC NOT NULL,
        PRIMARY KEY (userid, custodyaddress, deviceid)
      )
    `)

    await authDb.query('COMMIT')
    console.log('Schema and tables verified/created successfully')
  } catch (err) {
    await authDb.query('ROLLBACK')
    console.error(
      'Error in schema/table creation in destination DB:',
      (err as Error).stack,
    )
  }
}

async function checkAndReplicateData() {
  try {
    const maxBlockQueryResult = await authDb.query(`
      SELECT COALESCE(MAX(block_num), 0) as max_block_number FROM public.users
    `)
    const lastProcessedBlockNumber =
      maxBlockQueryResult.rows[0].max_block_number

    const queryResult = await listenClient.query(
      `
      SELECT userid, "to", recovery, timestamp, log_addr, block_num FROM users
      WHERE block_num > $1
      ORDER BY block_num ASC
    `,
      [lastProcessedBlockNumber],
    )
    if (queryResult.rows.length > 0) {
      const res = await authDb.query(
        `
  INSERT INTO public.users (userid, "to", recovery, timestamp, log_addr, block_num)
  SELECT * FROM unnest($1::NUMERIC[], $2::TEXT[], $3::TEXT[], $4::NUMERIC[], $5::TEXT[], $6::NUMERIC[])
  ON CONFLICT (userid) DO UPDATE
  SET "to" = EXCLUDED."to", recovery = EXCLUDED.recovery, timestamp = EXCLUDED.timestamp, log_addr = EXCLUDED.log_addr, block_num = EXCLUDED.block_num
  RETURNING *
`,
        [
          queryResult.rows.map((row) => row.userid),
          queryResult.rows.map((row) =>
            typeof row.to === 'string' && row.to.startsWith('0x')
              ? row.to
              : `0x${row.to}`,
          ),
          queryResult.rows.map((row) =>
            typeof row.recovery === 'string' && row.recovery.startsWith('0x')
              ? row.recovery
              : `0x${row.recovery}`,
          ),
          queryResult.rows.map((row) => row.timestamp),
          queryResult.rows.map((row) =>
            typeof row.log_addr === 'string' && row.log_addr.startsWith('0x')
              ? row.log_addr
              : `0x${row.log_addr}`,
          ),
          queryResult.rows.map((row) => row.block_num),
        ],
      )
      console.log('Data replicated:', res.rows)
    }
  } catch (err) {
    console.error('Error during data replication:', err)
    if (err instanceof Error) {
      console.error('Error stack:', err.stack)
    }
  }
}

setInterval(checkAndReplicateData, 1000)

process.on('SIGINT', () => {
  console.log('yo sigint')
  Promise.all([listenClient.end(), authDb.end()])
    .then(() => {
      console.log('Both clients disconnected')
      process.exit()
    })
    .catch((err) =>
      console.error('Error during disconnection', (err as Error).stack),
    )
})
