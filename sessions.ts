import { Lucia, TimeSpan, type DatabaseSessionAttributes } from 'lucia'
import { adapter } from './db'

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
    }
}

export interface SessionAttributes extends DatabaseSessionAttributes {
    created?: Date
    session?: string
}

// placeholder 
const userId = 'exampleUserId' 

export const attributes: SessionAttributes = {
    userid: userId,
    expiresAt: new Date(Date.now() + 2 * 7 * 24 * 60 * 60 * 1000),
    created: new Date(),
    session: 'exampleSessionData' 
}



/* 
to create sessions FROM DOCS:

const session = await lucia.createSession(userId, {})

If you have database attributes defined, pass their values as the second argument.

const session = await lucia.createSession(userId, {
	country: "us"
})

declare module "lucia" {
	interface Register {
		Lucia: typeof lucia
		DatabaseSessionAttributes: DatabaseSessionAttributes
	}
}

interface DatabaseSessionAttributes {
	country: string
}

TO VALIDATE SESSIONS: 

const { session, user } = await lucia.validateSession(sessionId)

const { session } = await lucia.validateSession(sessionId)
if (session && session.fresh) {
	// set session cookie
}

const sessionId = lucia.readSessionCookie("auth_session=abc")
const sessionId = lucia.readBearerToken("Bearer abc")

CREATE COOKIES
const sessionCookie = lucia.createSessionCookie(session.id)

// set cookie directly
headers.set("Set-Cookie", sessionCookie.serialize())
// use your framework's cookie utility
setCookie(sessionCookie.name, sessionCookie.value, sessionCookie.attributes)

DELETE COOKIES: 

const sessionCookie = lucia.createBlankSessionCookie()

headers.set("Set-Cookie", sessionCookie.serialize())
setCookie(sessionCookie.name, sessionCookie.value, sessionCookie.attributes)

INVALIDATE SESSIONS FOR SINGLE USER: 

await lucia.invalidateSession(sessionId)

INVALIDATE ALL SESSIONS: 

await lucia.invalidateUserSessions(userId)

GET ALL SESSIONS FROM A SINGLE USER: 

const sessions = await lucia.getUserSessions(userId)

DELETE ALL EXPIRED SESSIONS: 

await lucia.deleteExpiredSessions()

SESSION COOKIESSSSS 

https://lucia-auth.com/guides/validate-session-cookies/

*/