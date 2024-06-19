import { app } from './server'
import { serve } from 'bun'

console.log("initialized here: index")

serve({
  fetch: app.fetch,
  port: process.env.PORT || 3030,
})

console.log(
  `Hono server started on http://localhost:${process.env.PORT || 3030}`,
)
