import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import { csrf } from 'hono/csrf'
import type { Session, User } from 'lucia'
import { lucia } from './lucia/auth'
import { cors } from 'hono/cors'

export const app = new Hono<{
  Variables: {
    user: User | null
    session: Session | null
  }
}>()

// Cross Site Request Forgery (CSRF) protection middleware
// app.use(csrf())

// // CORS middleware
// app.use(
//   '*',
//   cors({
//     origin: 'http://localhost:8081',
//     allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
//     allowHeaders: ['Content-Type', 'Authorization'],
//     exposeHeaders: ['Content-Length'],
//     maxAge: 600,
//     credentials: true,
//   }),
// )

// Session and user handling middleware
// app.use('*', async (c, next) => {
//   const sessionId = getCookie(c, lucia.sessionCookieName) ?? null
//   console.log('Session ID:', sessionId)

//   if (!sessionId) {
//     c.set('user', null)
//     c.set('session', null)
//     console.log('No session ID found, setting user and session to null')
//     return next()
//   }

//   const { session, user } = await lucia.validateSession(sessionId)

//   console.log('Validated Session:', session)
//   if (session && session.fresh) {
//     c.header('Set-Cookie', lucia.createSessionCookie(session.id).serialize(), {
//       append: true,
//     })
//     console.log('Session is fresh, setting session cookie')
//   } else if (!session) {
//     c.header('Set-Cookie', lucia.createBlankSessionCookie().serialize(), {
//       append: true,
//     })
//     console.log('No valid session found, setting blank session cookie')
//   }

//   c.set('user', user)
//   c.set('session', session)
//   return next()
// })

// Example route (uncomment and customize as needed)
// app.get('/', async (c) => {
//   const user = c.get('user')
//   const session = c.get('session')

//   console.log('Got session at main route:', session)
//   if (!user) {
//     return c.body(null, 401)
//   }
//   return c.body({ message: 'Hello, authenticated user!' })
// })

import './routes'
