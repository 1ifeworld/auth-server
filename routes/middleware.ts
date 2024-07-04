import { app } from '../app'

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