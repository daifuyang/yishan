import { join } from 'node:path'
import AutoLoad from '@fastify/autoload'
import type { ApiModule } from '@yishan/core-api'
import type { SystemRuntime } from '@yishan/core-system-api'
import seed from './seed'
import { registerCrmPermissions } from './permissions'

/**
 * 客户与派单业务模块。
 *
 * ## id 为什么是 `iximei_crm` 而不是 `iximei-crm`
 *
 * `orderModules()` 校验 `/^[a-z0-9_]{1,24}$/`，连字符会被直接拒绝启动。
 * 所以模块 id 用下划线，**对外 URL 前缀单独声明**为 `/api/iximei-crm`，
 * 两者不必相同（`moduleRoutePrefix()` 优先取显式 `prefix`）。
 *
 * ## tablePrefix 保持 `crm_`
 *
 * 表名前缀决定不了任何权限或路由，而线上 `crm_*` 21 张表、6 万多行业务数据
 * 都在这套名字下。改前缀等于全量 rename + 全量迁移，收益为零。
 */
const iximeiCrmModule: ApiModule<SystemRuntime> = {
  contractVersion: 2,
  id: 'iximei_crm',
  name: '客户与派单',
  version: '1.0.0',
  tablePrefix: 'crm_',
  prefix: '/api/iximei-crm',
  dependencies: [{ id: 'system', version: '^2.0.0' }],
  migrations: {
    id: 'iximei_crm',
    folder: join(__dirname, 'drizzle'),
    historyTable: '__drizzle_migrations_iximei_crm',
  },
  async register(router) {
    // 权限码必须在应用作用域内注册：路由的 `access.permission` 依赖它，
    // 且 `onRoute` 会用 x-permission-* 再核对一次声明。
    registerCrmPermissions()
    await router.register(AutoLoad, {
      dir: join(__dirname, 'routes'),
      autoHooks: true,
      cascadeHooks: true,
    })
  },
  async seed() {
    await seed()
  },
}

export default iximeiCrmModule
