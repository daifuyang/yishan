/**
 * moduleComponents.ts
 *
 * 把后端 menu.component 字符串（虚拟路径）映射到已编译的 React 组件。
 *
 * 组件注册表由 apps/yishan-admin/plugin.ts 在 onGenerateFiles 阶段生成，
 * 见 `src/.umi/module-components.ts`：
 *   - Core 页面：./system/user  → import('@/pages/system/user')
 *   - Module 页面：./modules/demo/todos  → import('@/modules/demo/pages/todos')
 *
 * 这里只做 key 转换 + 缺失提示，不在运行时读盘/读 manifest。
 *
 * 关于路由层 access：后端 /menus 已按角色过滤；后端 API 还有 module gate
 * 与 perms preHandler 兜底。前端不再做白名单，URL 落到全局 404。
 */

import React from 'react'
import { moduleComponentsMap } from '@@/module-components'

type Loader = () => Promise<{ default: React.ComponentType<unknown> }>

/**
 * 把 "./modules/demo/todos" 转换成模块组件注册表 key
 *  ./modules/demo/todos
 */
function moduleKey(componentKey: string): string | null {
  if (!componentKey.startsWith('./modules/')) return null
  return componentKey
}

/**
 * 把 "./system/user" 转换成 core 注册表 key
 *  ./system/user
 */
function coreKey(componentKey: string): string | null {
  if (componentKey.startsWith('./modules/')) return null
  if (!componentKey.startsWith('./')) return null
  return componentKey
}

/**
 * 返回 React.lazy 包装的组件。
 * - 命中：React.lazy(() => map[key]())
 * - 未命中：dev 模式 console.error，返回 null（patchClientRoutes 跳过该节点）
 */
export function resolve(
  componentKey: string | undefined,
): React.LazyExoticComponent<React.ComponentType<unknown>> | null {
  if (!componentKey || typeof componentKey !== 'string') return null

  const key = componentKey.startsWith('./modules/')
    ? moduleKey(componentKey)
    : coreKey(componentKey)

  if (!key) return null

  const loader = moduleComponentsMap[key]
  if (!loader) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error(`[modules] 找不到组件，请检查：${componentKey}`)
    }
    return null
  }

  return React.lazy(() => (loader() as ReturnType<Loader>))
}

/**
 * 给测试/单测使用：导出 keys，让单测能断言"删除模块后 keys 集合变化"。
 */
export function debugKeys(): { core: string[]; module: string[] } {
  const keys = Object.keys(moduleComponentsMap)
  return {
    core: keys.filter((k) => !k.startsWith('./modules/')),
    module: keys.filter((k) => k.startsWith('./modules/')),
  }
}
