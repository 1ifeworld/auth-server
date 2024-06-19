import { Hono } from 'hono'
import { signMessageRoute } from './signMessage'
import { generateEncryptKeysAndSessionId } from './genKeysAndSession'
import { signWithSession } from './SignWithSession'

export const routes = new Hono()

routes.route('/sign', signMessageRoute)
routes.route('/genKeys', generateEncryptKeysAndSessionId)
routes.route('/signWithSession', signWithSession)