import { Hono } from 'hono'
import { signWithSession } from './SignWithSession'
import { generateEncryptKeysAndSessionId } from './genKeysAndSession'
import { signMessageRoute } from './signMessage'

export const routes = new Hono()

routes.route('/sign', signMessageRoute)
routes.route('/genKeys', generateEncryptKeysAndSessionId)
routes.route('/signWithSession', signWithSession)
