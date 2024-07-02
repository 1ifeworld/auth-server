import { Hono } from 'hono'
import type { Session, User } from 'lucia'

export const app = new Hono<{
  Variables: {
    user: User | null
    session: Session | null
  }
}>()

export default {
  fetch: app.fetch
}
