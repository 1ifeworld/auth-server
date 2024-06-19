import { DrizzlePostgreSQLAdapter } from '@lucia-auth/adapter-drizzle'
import { Lucia, TimeSpan } from 'lucia'
import type {
  RegisteredDatabaseSessionAttributes,
  RegisteredDatabaseUserAttributes,
} from 'lucia'
import { db } from './db'
import * as dbSchema from './schema'

export interface UserAttributes {
  userId: number
  to: string
  recovery: string
  timestamp: string
}

export interface SessionAttributes {
  userid: number
  deviceid: string
  created: Date
  expiresAt: Date
}

interface DatabaseSessionAttributes {
  userid: number
  deviceid: string
  expiresAt: Date
  created: Date
}


const adapter = new DrizzlePostgreSQLAdapter(
  db,
  dbSchema.sessionsTable,
  dbSchema.usersTable,
)

export const lucia = new Lucia<DatabaseSessionAttributes, UserAttributes>(adapter, {
  sessionExpiresIn: new TimeSpan(2, 'w'),
  sessionCookie: {
    expires: false,
    attributes: {
      secure: false,
    },
  },
  getSessionAttributes(
    databaseSessionAttributes: DatabaseSessionAttributes,
  ) {
    return {
      userid: databaseSessionAttributes.userid,
      deviceid: databaseSessionAttributes.deviceid,
      created: new Date(databaseSessionAttributes.created),
      expiresAt: new Date(databaseSessionAttributes.expiresAt),
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
