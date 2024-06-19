import { sql } from 'drizzle-orm'
import { db } from '../clients/db'
import * as dbSchema from '../database/schema'

export async function getUserId(sessionId: string): Promise<number> {
  const result = await db
    .select({ userId: dbSchema.sessionsTable.userId })
    .from(dbSchema.sessionsTable)
    .where(sql`${dbSchema.sessionsTable.id} = ${sessionId}`)
    .limit(1)
    .execute()
  if (result.length > 0) {
    console.log(`User ID for session ${sessionId}:`, result[0].userId)
    return Number(result[0].userId)
  } else {
    throw new Error('No user found')
  }
}

export async function getDeviceId(custodyAddress: string): Promise<string> {
  const result = await db
    .select({ deviceId: dbSchema.hashesTable.deviceid })
    .from(dbSchema.hashesTable)
    .where(sql`${dbSchema.hashesTable.custodyAddress} = ${custodyAddress}`)
    .limit(1)
    .execute()
  if (result.length > 0) {
    console.log(`deviceId for session ${custodyAddress}:`, result[0].deviceId)
    return result[0].deviceId
  } else {
    throw new Error('No deviceId found')
  }
}
