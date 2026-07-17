import { createServer } from 'node:http'
import { handler } from './migration-runner.js'

const port = Number(process.env.FC_SERVER_PORT ?? process.env.PORT ?? '3000')

const server = createServer(async (request, response) => {
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
