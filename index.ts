import { Hono } from "hono"
import type { Session, User } from 'lucia'

export const app = new Hono<{
  Variables: {
    user: User | null
    session: Session | null
  }
}>()

export default {
  port: 3000,
  fetch: app.fetch,
}

console.log('hi')
