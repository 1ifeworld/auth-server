import { db } from './db'
import * as dbSchema from './schema'

export async function getUserId(userId: number): Promise<number> {
  const result = await db
    .select({ id: dbSchema.usersTable.id })
    .from(dbSchema.usersTable)
    .limit(1)
    .execute()
  if (result.length > 0) {
    return Number(result[0].id)
  } else {
    throw new Error('No user found')
  }
}
