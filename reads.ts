import { db } from './db'
import * as dbSchema from './schema'
import { sql } from 'drizzle-orm'


export async function getUserId(sessionId: string): Promise<number> {
  const result = await db
    .select({ userId: dbSchema.sessionsTable.userId })
    .from(dbSchema.sessionsTable)
    .where(sql`${dbSchema.sessionsTable.id} = ${sessionId}`)
    .limit(1)
    .execute()
  if (result.length > 0) {
    return Number(result[0].userId)
  } else {
    throw new Error('No user found')
  }
}