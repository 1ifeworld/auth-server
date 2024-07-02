import { app } from './routes'

// Bun.serve({
//   fetch: app.fetch,
//   port: 3030,
// })

export default {
  port: 3000,
  fetch: app.fetch,
}

console.log('hi')
