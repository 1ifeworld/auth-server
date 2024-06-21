import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import { csrf } from 'hono/csrf'
import type { Session, User } from 'lucia'
import { lucia } from './lucia/auth'
import { cache } from 'hono/cache'
import { cors } from 'hono/cors'

export const app = new Hono<{
  Variables: {
    user: User | null
    session: Session | null
  }
}>()

// Cross Site Request Forgery (CSRF) protection middleware
app.use(csrf())

app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
    credentials: true,
  }),
)

app.use('*', async (c, next) => {
  const sessionId = getCookie(c, lucia.sessionCookieName) ?? null
  console.log({sessionId})

  if (!sessionId) {
    c.set('user', null)
    c.set('session', null)
    console.log("sorry pal")
    return next()
  }

  const { session, user } = await lucia.validateSession(sessionId)
  console.log({ session })
  if (session && session.fresh) {
    c.header('Set-Cookie', lucia.createSessionCookie(session.id).serialize(), {
      append: true,
    })
  }
  if (!session) {
    c.header('Set-Cookie', lucia.createBlankSessionCookie().serialize(), {
      append: true,
    })
  }
  c.set('user', user)
  c.set('session', session)
  return next()
})

app.get('/', async (c) => {
  const user = c.get('user')
  const session = c.get('session')

  console.log('got session at main', session)
  if (!user) {
    return c.body(null, 401)
  }
})

import './routes'
