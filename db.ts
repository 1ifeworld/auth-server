import { drizzle } from 'drizzle-orm/node-postgres'
import { Client } from 'pg'

const pool = new Client({
  connectionString: process.env.DATABASE_URL!,
})

const connected = await pool.connect()
console.log({ connected })

export const db = drizzle(pool)
console.log({ db })
