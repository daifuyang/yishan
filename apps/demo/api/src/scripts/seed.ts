import 'dotenv/config'
import { seedSystem, finalizeSystemSeed } from '@yishan/core-system-api'
import { buildApp } from '../app'
import { loadConfig } from '../config'
import { demoModules } from '../manifest'

async function main() {
  const app = await buildApp(loadConfig())
  try {
    await app.system.run(async () => {
      await seedSystem()
      for (const module of demoModules) await module.seed?.(app.system)
      await finalizeSystemSeed()
    })
    console.log('Installed module seeds completed')
  } finally { await app.close() }
}

if (require.main === module) void main().catch(error => { console.error(error); process.exitCode = 1 })
