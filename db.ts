import { DrizzlePostgreSQLAdapter } from '@lucia-auth/adapter-drizzle'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Client } from 'pg'
import * as dbSchema from './schema'

const pool = new Client({
  connectionString: process.env.DATABASE_URL!,
})

const connected = await pool.connect()
console.log({connected})

const db = drizzle(pool)
console.log({db})

export const adapter = new DrizzlePostgreSQLAdapter(
  db,
  dbSchema.sessionsTable,
  dbSchema.usersTable,
)


