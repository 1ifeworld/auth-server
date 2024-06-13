import { DrizzlePostgreSQLAdapter } from '@lucia-auth/adapter-drizzle'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Client } from 'pg'
import * as dbSchema from './schema'

const pool = new Client({
  connectionString: process.env.DATABASE_URL!,
})

await pool.connect()

const db = drizzle(pool)

export const adapter = new DrizzlePostgreSQLAdapter(
  db,
  dbSchema.sessionsTable,
  dbSchema.usersTable,
)
