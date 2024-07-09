import { app } from '../app'
import { cors } from 'hono/cors'

app.get('/', async (c) => {
  const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>dimelo</title>
      </head>
      </html>
    `
  return c.html(htmlContent)
})
