import { Lucia, TimeSpan, type DatabaseSessionAttributes } from 'lucia'
import { adapter } from './db'
import { randomBytes } from '@noble/hashes/utils'


export const lucia = new Lucia(adapter, {
  sessionExpiresIn: new TimeSpan(2, "w")
})

declare module 'lucia' {
  interface Register {
    Lucia: typeof lucia
    DatabaseSessionAttributes: DatabaseSessionAttributes
  }
  interface DatabaseSessionAttributes {
    userid: string
    expiresAt: Date
    deviceId: string
  }
}

export interface SessionAttributes extends DatabaseSessionAttributes {
  created?: Date
  id?: string
}

// Placeholder userId
const userId = 'exampleUserId'
const deviceId = 'exampleDeviceId' // Placeholder deviceId

export const attributes: SessionAttributes = {
  userid: userId,
  expiresAt: new Date(Date.now() + 2 * 7 * 24 * 60 * 60 * 1000),
  created: new Date(),
  id: 'exampleSessionData',
  deviceId: deviceId,
}

export function generateRandomSessionString(length: number = 32): string {
  const randomBuffer = randomBytes(length)
  return Buffer.from(randomBuffer).toString('hex')
}

/* 
To create sessions FROM DOCS:

const session = await lucia.createSession(userId, { deviceId: 'device123' })

If you have database attributes defined, pass their values as the second argument.

const session = await lucia.createSession(userId, {
  country: "us",
  deviceId: 'device123'
})

To validate sessions:

const { session, user } = await lucia.validateSession(id)

const { session } = await lucia.validateSession(id)
if (session && session.fresh) {
  // set session cookie
}

const id = lucia.readSessionCookie("auth_session=abc")
const id = lucia.readBearerToken("Bearer abc")

Create cookies:

const sessionCookie = lucia.createSessionCookie(session.id)

// set cookie directly
headers.set("Set-Cookie", sessionCookie.serialize())
// use your framework's cookie utility
setCookie(sessionCookie.name, sessionCookie.value, sessionCookie.attributes)

Delete cookies:

const sessionCookie = lucia.createBlankSessionCookie()

headers.set("Set-Cookie", sessionCookie.serialize())
setCookie(sessionCookie.name, sessionCookie.value, sessionCookie.attributes)

Invalidate sessions for single user:

await lucia.invalidateSession(id)

Invalidate all sessions:

await lucia.invalidateUserSessions(userId)

Get all sessions from a single user:

const sessions = await lucia.getUserSessions(userId)

Delete all expired sessions:

await lucia.deleteExpiredSessions()

Session cookies guide: 

https://lucia-auth.com/guides/validate-session-cookies/
*/

