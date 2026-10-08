/**
 * demo 模块的种子入口。
 *
 * 入驻脚本（scripts/onboard-modules.ts）在本模块迁移成功后调用 default 导出，并传入数据库句柄。
 * 菜单树声明在 ./config/system-menu.json，由 system 公开的 `seedModuleMenus` 登记
 * （写 sys_menu / sys_menu_permission）；本模块不直接接触 system 的表。
 *
 * 模块自身的表由 drizzle 迁移创建；sys_module 行由 core/module-loader 统一同步。
 */

import type { ModuleSeedContext } from '@/core/module-api.js'
import { flattenMenuTree, seedModuleMenus, toBool, type ModuleMenuNode } from '@/core/system-api.js'
import adminMenu from './config/system-menu.json'

/** 菜单节点类型（JSON 中“是否”字段用 0/1）。保留旧名供测试与下游引用。 */
export type AdminMenuNode = ModuleMenuNode
export { flattenMenuTree, toBool }

const menuTree = adminMenu as AdminMenuNode[]

export default async function seedDemo(ctx?: ModuleSeedContext): Promise<void> {
  const { menus, permissionBindings } = await seedModuleMenus(menuTree, ctx?.db)
  console.log(`demo seed: 菜单已写入（${menus} 个菜单行，${permissionBindings} 条权限绑定）`)
}

// 直接执行（node dist/modules/demo/seed.js）时才运行；被 import 时（单测、入驻脚本）不触发。
if (require.main === module) {
  seedDemo().catch((err) => {
    console.error('[demo seed] 异常退出:', err)
    process.exit(1)
  })
}
