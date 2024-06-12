import { Hono } from "hono"
import type { User, Session } from 'lucia'


export const app = new Hono<{
	Variables: {
		user: User | null
		session: Session | null
	}
}>()
