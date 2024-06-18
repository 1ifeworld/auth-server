import { drizzle } from 'drizzle-orm/node-postgres'
import { Client } from 'pg'

const pool = new Client({
  connectionString: process.env.WRITE_DATABASE_URL!,
})

await pool.connect()

export const db = drizzle(pool)
