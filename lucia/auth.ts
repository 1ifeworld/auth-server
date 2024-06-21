import { DrizzlePostgreSQLAdapter } from '@lucia-auth/adapter-drizzle'
import { Lucia, TimeSpan } from 'lucia'
import { db } from '../clients/db'
import * as dbSchema from '../database/schema'

export interface UserAttributes {
  userId: number
  to: string
  recovery: string
  timestamp: string
}

export interface SessionAttributes {
  userId: number
  deviceId: string
  created: Date
  expiresAt: Date
}

const adapter = new DrizzlePostgreSQLAdapter(
  db,
  dbSchema.sessionsTable,
  dbSchema.usersTable,
)

export const lucia = new Lucia<SessionAttributes, UserAttributes>(adapter, {
  sessionExpiresIn: new TimeSpan(2, 'w'),
  sessionCookie: {
    name: 'AYO THIS IS A GALLETA I MADE',
    expires: false,
    attributes: {
      secure: false,
    },
  },
  getSessionAttributes(databaseSessionAttributes: SessionAttributes) {
    return {
      userId: databaseSessionAttributes.userId,
      deviceId: databaseSessionAttributes.deviceId,
      created: new Date(databaseSessionAttributes.created),
      expiresAt: new Date(databaseSessionAttributes.expiresAt),
    }
  },
  getUserAttributes(databaseUserAttributes: UserAttributes) {
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

/// usage example not currently being used
// export async function createAndValidateSession(sessionId: string) {
//   const userId = await getUserId(sessionId)
//   sessionAttributes.userId = userId

//     const deviceId = await getDeviceId(custodyAddress).catch(() => custodyAddress)
//     console.log("YOOOOOO", deviceId)
//     sessionAttributes.deviceId = deviceId

//   const session = await lucia.createSession(
//     userId.toString(),
//     sessionAttributes,
//   )

//   const { session: validatedSession, user } = await lucia.validateSession(
//     session.id,
//   )

//   const sessionCookie = lucia.createSessionCookie(validatedSession!.id)
//   const headers = new Headers()
//   headers.set('Set-Cookie', sessionCookie.serialize())

//   return { validatedSession, user, headers }
// }

// createAndValidateSession('initialSessionId').then(({ validatedSession, user, headers }) => {
//   console.log('Validated Session:', validatedSession)
//   console.log('User:', user)
//   console.log('Set-Cookie header:', headers.get('Set-Cookie'))
// })
