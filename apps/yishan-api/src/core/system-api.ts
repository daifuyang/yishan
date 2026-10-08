/**
 * system-api.ts — system 默认实现对业务模块开放的稳定能力（纯重导出）。
 *
 * 与 `module-api.ts`（kernel 契约）分开：这里的能力属于可替换的 system 实现。
 * 模块只能通过本文件使用 system，不得直接导入 system 的表、仓储或服务。
 * 替换 system 的项目需要提供同名导出（或删除依赖它们的模块 seed）。
 */
export {
  seedModuleMenus,
  flattenMenuTree,
  toBool,
  type ModuleMenuNode,
  type FlatMenuNode,
} from './services/module-menu-seed.service.js'
