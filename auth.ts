import { DrizzlePostgreSQLAdapter } from '@lucia-auth/adapter-drizzle'
import { randomBytes } from '@noble/hashes/utils'
import { Lucia, TimeSpan } from 'lucia'
import type {
  RegisteredDatabaseSessionAttributes,
  RegisteredDatabaseUserAttributes,
} from 'lucia'
import { alphabet, generateRandomString } from 'oslo/crypto'
import { db } from './db'
import { getUserId, getDeviceId } from './reads'
import * as dbSchema from './schema'
import { custodyAddress } from './keys'

export interface UserAttributes {
  userId: number
  to: string
  recovery: string
  timestamp: string
}

export interface SessionAttributes {
  userId: number
  expiresAt: Date
  deviceId: string
}

const adapter = new DrizzlePostgreSQLAdapter(
  db,
  dbSchema.sessionsTable,
  dbSchema.usersTable,
)

export const lucia = new Lucia<SessionAttributes, UserAttributes>(adapter, {
  sessionExpiresIn: new TimeSpan(2, 'w'),
  sessionCookie: {
    expires: false,
    attributes: {
      secure: true,
    },
  },
  getSessionAttributes(
    databaseSessionAttributes: RegisteredDatabaseSessionAttributes,
  ): SessionAttributes {
    return {
      userId: databaseSessionAttributes.userId,
      expiresAt: new Date(databaseSessionAttributes.expiresAt),
      deviceId: databaseSessionAttributes.deviceId,
    }
  },
  getUserAttributes(
    databaseUserAttributes: RegisteredDatabaseUserAttributes,
  ): UserAttributes {
    return {
      userId: databaseUserAttributes.userId,
      to: databaseUserAttributes.to,
      recovery: databaseUserAttributes.recovery,
      timestamp: databaseUserAttributes.timestamp,
    }
  },
})

declare module 'lucia' {
  interface Register {
    Lucia: typeof lucia
    DatabaseUserAttributes: UserAttributes
    DatabaseSessionAttributes: SessionAttributes
  }
}

// const generateDeviceId = generateRandomString(10, alphabet('a-z', 'A-Z', '0-9', '-', '_'))

export const sessionAttributes: SessionAttributes = {
  userId: 0,
  expiresAt: new Date(Date.now() + 2 * 7 * 24 * 60 * 60 * 1000),
  deviceId: '', 
}

async function createAndValidateSession(sessionId: string) {
  const userId = await getUserId(sessionId)
  sessionAttributes.userId = userId

    const deviceId = await getDeviceId(custodyAddress).catch(() => custodyAddress)
    sessionAttributes.deviceId = deviceId

  const session = await lucia.createSession(
    userId.toString(),
    sessionAttributes,
  )

  const { session: validatedSession, user } = await lucia.validateSession(
    session.id,
  )

  const sessionCookie = lucia.createSessionCookie(validatedSession!.id)
  const headers = new Headers()
  headers.set('Set-Cookie', sessionCookie.serialize())

  return { validatedSession, user, headers }
}

createAndValidateSession('initialSessionId').then(({ validatedSession, user, headers }) => {
  console.log('Validated Session:', validatedSession)
  console.log('User:', user)
  console.log('Set-Cookie header:', headers.get('Set-Cookie'))
})
