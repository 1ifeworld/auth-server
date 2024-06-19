import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import { csrf } from 'hono/csrf'
import type { Session, User } from 'lucia'
import { lucia } from './lucia/auth'
import { routes } from './routes'

export const app = new Hono<{
  Variables: {
    user: User | null
    session: Session | null
  }
}>()

// verifyRequestOrigin(origin, ["https://www.river.ph/*"])

// // cross site request forgery helper
app.use(csrf())

app.use('*', async (c, next) => {
  const id = getCookie(c, lucia.sessionCookieName) ?? null
  console.log({ id })
  if (!id) {
    c.set('user', null)
    c.set('session', null)
    return next()
  }
  console.log('session chexx')
  const { session, user } = await lucia.validateSession(id)
  console.log('sessionpost')
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

app.route('/', routes)

app.get('/', async (c) => {
  const user = c.get('user')
  const session = c.get('session')

  console.log('got session at main', session)
  if (!user) {
    return c.body(null, 401)
  }
})
