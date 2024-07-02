import { Hono } from 'hono'
import type { Session, User } from 'lucia'

const app = new Hono<{
  Variables: {
    user: User | null
    session: Session | null
  }
}>()

export { app }