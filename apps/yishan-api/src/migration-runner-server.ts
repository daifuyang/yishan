import { createServer } from 'node:http'
import { handler } from './migration-runner.js'

// Match the production custom runtime contract: customRuntimeConfig declares
// port 3000 and the process may override it only through PORT.
const port = Number(process.env.PORT ?? '3000')

const server = createServer(async (request, response) => {
  // FC Custom Runtime probes the configured port with GET before forwarding an
  // invocation. There is no HTTP trigger, so this endpoint is not public.
  if (request.method === 'GET') {
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ status: 'ok' }))
    return
  }

  if (request.method !== 'POST') {
    response.writeHead(405, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ error: 'Only invocation POST requests are supported' }))
    return
  }

  try {
    const chunks: Buffer[] = []
    for await (const chunk of request) chunks.push(Buffer.from(chunk))
    const rawEvent = Buffer.concat(chunks).toString('utf8')
    const event = rawEvent ? JSON.parse(rawEvent) : {}
    const result = await handler(event)
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify(result))
  } catch (error) {
    console.error(error)
    response.writeHead(500, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }))
  }
})

server.listen(port, '0.0.0.0', () => {
  console.log(`Migration runner custom runtime listening on ${port}`)
})
