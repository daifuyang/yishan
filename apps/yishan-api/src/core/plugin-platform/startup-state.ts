/**
 * 启动状态纯函数。
 *
 * 集中维护“根据数据库快照和已发现的 manifest 计算启动时启用的插件集合”
 * 的纯函数。`app.ts` 在启动期间必须调用本文件导出的函数，禁止内联复制条件。
 *
 * 不允许：
 *  - 在测试文件中复制本函数后断言其行为，测试必须 import 此处的导出。
 *  - 在 import 本模块的链路中产生副作用（除类型导入外）。
 */

import type { PluginManifest } from './types.js'
import type { PluginStateSnapshot } from './persistence.js'

/**
 * 根据数据库快照返回启动时应启用的插件名称集合。
 *
 * 行为约束：
 *  - 只读 snapshot，不写任何持久化数据；
 *  - 数据库无记录的插件保持 disabled（绝不猜测默认 enabled）；
 *  - 返回值是 manifest name 集合，便于直接调用 `lifecycle.enable`。
 */
export function getEnabledPluginNames(
  manifests: PluginManifest[],
  states: PluginStateSnapshot[],
): Set<string> {
  const enabledIds = new Set(
    states.filter((state) => state.enabled).map((state) => state.pluginId),
  )
  return new Set(
    manifests
      .filter((manifest) => enabledIds.has(manifest.pluginId))
      .map((manifest) => manifest.name),
  )
}

/**
 * 启动编排辅助：根据 manifest 列表和 strict state reader 返回应启用的 manifest。
 *
 * 用于集成测试和未来可能注入的 fake runtime；纯输入输出，不持有任何模块级状态。
 */
export async function loadEnabledPluginManifests(args: {
  manifests: PluginManifest[]
  readStatesStrict: () => Promise<PluginStateSnapshot[]>
}): Promise<{ manifest: PluginManifest }[]> {
  const states = await args.readStatesStrict()
  const names = getEnabledPluginNames(args.manifests, states)
  return args.manifests
    .filter((manifest) => names.has(manifest.name))
    .map((manifest) => ({ manifest }))
}
