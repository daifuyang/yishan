import { join } from 'node:path'
import AutoLoad from '@fastify/autoload'
import type { ApiModule } from '@yishan/core-api'
import type { SystemRuntime } from '@yishan/core-system-api'
import seed from './seed'

const portalModule: ApiModule<SystemRuntime> = {
  contractVersion: 2, id: 'portal', name: 'portal', version: '1.0.0', tablePrefix: 'portal_',
  dependencies: [{ id: 'system', version: '^2.0.0' }],
  migrations: { id: 'portal', folder: join(__dirname, 'drizzle'), historyTable: '__drizzle_migrations_portal' },
  async register(router) {
    await router.register(AutoLoad, { dir: join(__dirname, 'routes'), autoHooks: true, cascadeHooks: true })
  },
  async seed() { await seed() },
}
export default portalModule
