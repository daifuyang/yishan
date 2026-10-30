import 'dotenv/config'
import { buildApp } from './app'
import { loadConfig } from './config'

async function main() {
  const config = loadConfig()
  const app = await buildApp(config)
  let closing = false
  const close = async () => {
    if (closing) return
    closing = true
    await app.close()
  }
  process.once('SIGINT', () => { void close().catch(error => { app.log.error(error); process.exitCode = 1 }) })
  process.once('SIGTERM', () => { void close().catch(error => { app.log.error(error); process.exitCode = 1 }) })
  try { await app.listen({ host: config.host, port: config.port }) }
  catch (error) { await close(); throw error }
}

if (require.main === module) {
  void main().catch(error => { console.error(error); process.exitCode = 1 })
}
