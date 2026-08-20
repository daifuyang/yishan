/**
 * infrastructure/migrations/server.ts
 *
 * FC Custom Runtime 入口，监听 PORT（默认 3000，与 runner.yaml 的 customRuntimeConfig.port 对齐）。
 *
 * 协议：s invoke 工具会 POST 一个 event payload 到根路径；我们也兼容 GET 作为存活探针。
 * 工作流 yishan-fc-migrate 通过 s invoke --event '{"mode":"dry-run"}' 触发此入口。
 */
import { createServer } from 'node:http'
import { handler, type MigrationRunnerEvent, type MigrationRunnerResult } from './runner.js'

const port = Number(process.env.PORT ?? process.env.FC_CUSTOM_LISTEN_PORT ?? '3000')

const server = createServer(async (request, response) => {
  if (request.method === 'GET') {
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ status: 'ok', role: 'migration-runner' }))
    return
  }

  if (request.method !== 'POST') {
    response.writeHead(405, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ error: 'Only POST invocations are supported' }))
    return
  }

  try {
    const chunks: Buffer[] = []
    for await (const chunk of request) chunks.push(Buffer.from(chunk))
    const rawEvent = Buffer.concat(chunks).toString('utf8')
    const event: MigrationRunnerEvent = rawEvent ? JSON.parse(rawEvent) : {}
    const result = await handler(event)
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify(result satisfies MigrationRunnerResult))
  } catch (error) {
    console.error('[migration-runner] invoke failed:', error)
    response.writeHead(500, { 'content-type': 'application/json' })
    response.end(
      JSON.stringify({
        mode: 'unknown',
        status: 'failed',
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        plan: [],
        error: error instanceof Error ? error.message : String(error),
      }),
    )
  }
})

server.listen(port, '0.0.0.0', () => {
  console.log(`[migration-runner] listening on 0.0.0.0:${port}`)
})

// 不要在 SIGTERM 时立刻退出；FC Custom Runtime 会等响应完成再回收实例
process.on('SIGTERM', () => {
  console.log('[migration-runner] SIGTERM received, closing server')
  server.close(() => process.exit(0))
})
