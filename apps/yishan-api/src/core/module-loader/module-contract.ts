/**
 * module-contract.ts — 模块与 kernel 之间的生命周期契约（仅类型）。
 */
import type { AppDb } from '../../db/client.js'

/**
 * `module.ts` 导出的 `meta`。保持扁平对象（构建期脚本用正则读取 `enabled`）。
 *   - id：等于目录名，/^[a-z][a-z0-9_]{0,23}$/；路由前缀 `/api/<id>`、表前缀 `<id>_`、
 *     迁移历史表 `<id>_drizzle_migrations` 都由它推导。
 *   - enabled：装载开关（false = 不打包、不挂载、不迁移）；流量开关在 sys_module.enabled。
 *   - name / version / description：展示用；description 作为 OpenAPI 中模块 tag 的描述。
 */
export interface ModuleMeta {
  id: string
  enabled?: boolean
  name?: string
  version?: string
  description?: string
}

/** 模块 seed 入口（seed.ts 的 default 导出）收到的上下文；由入驻脚本传入。 */
export interface ModuleSeedContext {
  db: AppDb
}
