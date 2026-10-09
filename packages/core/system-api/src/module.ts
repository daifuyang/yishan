import { join } from 'node:path'
import AutoLoad from '@fastify/autoload'
import type { ApiModule } from '@yishan/core-api'
import type { SystemRuntime } from './runtime'

export const systemModule: ApiModule<SystemRuntime> = {
  contractVersion: 2,
  id: 'system',
  name: '系统管理',
  version: '2.0.0',
  tablePrefix: 'sys_',
  prefix: '',
  migrations: { id: 'system', folder: join(__dirname, 'drizzle'), historyTable: '__drizzle_migrations' },
  async register(router, runtime) {
    await runtime.run(() => router.register(AutoLoad, {
      dir: join(__dirname, 'core/routes'),
      ignoreFilter: filepath => filepath.includes('/_dev/') || /\/(admin-crud|route-registrar)\.[tj]s$/.test(filepath),
      autoHooks: true,
      cascadeHooks: true,
    }))
  },
}
