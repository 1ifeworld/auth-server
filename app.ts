import { Hono } from 'hono'
import type { Session, User } from 'lucia'
import { cors } from 'hono/cors'

const app = new Hono<{
  Variables: {
    user: User | null
    session: Session | null
  }
}>()

app.use(
  '*',
  cors({
    origin: 'http://localhost:8081', // Allow requests from your client's origin
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
    credentials: true,
  }),
)

export { app }
