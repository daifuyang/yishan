/**
 * module-api.ts — 业务模块唯一允许的 Yishan 静态入口（纯重导出，不含任何逻辑）。
 *
 * 模块（src/modules/<id>/）只从这里导入 Yishan 公共契约；运行时依赖走 Fastify 原生机制：
 *   - 数据库：`app.drizzleDb`（database 插件装饰器）→ 构造注入给 service / repository
 *   - 当前用户：`request.currentUser`（最小形状见 `Principal`）
 *   - 日志：`request.log` / `app.log`
 * system 默认实现对模块开放的能力（如菜单 seed）在 `system-api.ts`，不混进这里。
 *
 * 边界由 `scripts/check-architecture-boundaries.mjs` 执行：模块不得直接导入
 * `core/` 内部文件、`db/schema` 或其他模块。
 */
export {
  registerPermissions,
  registerPermissionGroups,
  type PermissionRef,
  type PermissionGroupRef,
} from './permissions/catalog.js'
export {
  createRouteRegistrar,
  type RouteAccess,
  type ManagedRouteOptions,
  type RouteRegistrar,
} from './routes/route-registrar.js'
export type { Principal } from './auth/identity.js'
export type { ModuleMeta, ModuleSeedContext } from './module-loader/module-contract.js'
export { ResponseUtil } from '../utils/response.js'
export { BusinessError } from '../exceptions/business-error.js'
export type { AppDb, AppTx, AppQueryDb } from '../db/client.js'
