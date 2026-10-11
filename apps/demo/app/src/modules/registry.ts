import { hasRequiredPermissions } from '@yishan/core-app/permissions'
export { hasRequiredPermissions } from '@yishan/core-app/permissions'
import { normalizePage } from '@yishan/core-app/router'
export { normalizePage } from '@yishan/core-app/router'
import type { WorkbenchMenuNode } from '@/api/types'
import { isRegisteredPage } from '@/constants/page-config'

/** 实际移动端页面注册；工作台入口以 page 与 entry 匹配，未注册的入口不展示。 */
export interface MobileModule {
  id: string
  name: string
  icon: string
  entry: string
  backendModuleId: string
  permissions: readonly string[]
  implemented?: boolean
  showInWorkbench?: boolean
  keywords?: readonly string[]
}

export const MOBILE_MODULES: readonly MobileModule[] = [
  {
    id: 'contacts',
    backendModuleId: 'core',
    name: '通讯录',
    icon: 'ContactsOutlined',
    entry: 'pages/contacts/index/index',
    permissions: ['app:contacts:dept-tree'],
    keywords: ['contacts', '成员'],
  },
  {
    id: 'system-user',
    backendModuleId: 'core',
    name: '用户管理',
    icon: 'UserOutlined',
    entry: 'pages/system/user/index',
    permissions: ['system:user:list'],
    keywords: ['user'],
  },
  {
    id: 'system-dept',
    backendModuleId: 'core',
    name: '部门管理',
    icon: 'ApartmentOutlined',
    entry: 'pages/system/dept/index',
    permissions: ['system:department:list'],
    implemented: true,
  },
  {
    id: 'system-login-log',
    backendModuleId: 'core',
    name: '登录日志',
    icon: 'AuditOutlined',
    entry: 'pages/system/login-log/index',
    permissions: ['system:login-log:list'],
    implemented: true,
  },
  {
    id: 'system-dict',
    backendModuleId: 'core',
    name: '字典管理',
    icon: 'BookOutlined',
    entry: 'pages/system/dict/index',
    permissions: ['system:dict:list'],
    implemented: true,
  },
  {
    id: 'system-role', backendModuleId: 'core', name: '角色管理', icon: 'SafetyCertificateOutlined',
    entry: 'pages/system/role/index', permissions: ['system:role:list'],
  },
  {
    id: 'system-position', backendModuleId: 'core', name: '岗位管理', icon: 'IdcardOutlined',
    entry: 'pages/system/position/index', permissions: ['system:position:list'],
  },
  {
    id: 'system-menu', backendModuleId: 'core', name: '菜单管理', icon: 'MenuOutlined',
    entry: 'pages/system/menu/index', permissions: ['system:menu:list'],
  },
  {
    id: 'system-app-menu', backendModuleId: 'core', name: '工作台管理', icon: 'AppstoreOutlined',
    entry: 'pages/system/app-menu/index', permissions: ['system:app-menu:list'],
  },
  {
    id: 'system-region', backendModuleId: 'core', name: '地区管理', icon: 'EnvironmentOutlined',
    entry: 'pages/system/region/index', permissions: ['region:tree'],
  },
  {
    id: 'system-site', backendModuleId: 'core', name: '站点配置', icon: 'GlobalOutlined',
    entry: 'pages/system/site/index', permissions: ['system:option:list'],
  },
  {
    id: 'system-storage', backendModuleId: 'core', name: '云存储', icon: 'CloudUploadOutlined',
    entry: 'pages/system/storage/index', permissions: ['system:storage:list'],
  },
  {
    id: 'system-attachments', backendModuleId: 'core', name: '媒体库', icon: 'PictureOutlined',
    entry: 'pages/system/attachments/index', permissions: ['system:attachment:list'],
  },
  {
    id: 'system-module-management', backendModuleId: 'core', name: '模块管理', icon: 'AppstoreOutlined',
    entry: 'pages/system/module-management/index', permissions: ['system:module-management:list'],
  },
  {
    id: 'demo-quickstart', backendModuleId: 'demo', name: '快速入门', icon: 'ReadOutlined',
    entry: 'pages/demo/quickstart/index', permissions: ['demo:quickstart:read'], keywords: ['入门'],
  },
  {
    id: 'demo-health', backendModuleId: 'demo', name: '健康检查', icon: 'SmileOutlined',
    entry: 'pages/demo/health/index', permissions: ['demo:health:read'], keywords: ['运行状态'],
  },
  {
    id: 'demo-todos', backendModuleId: 'demo', name: 'Todo 示例', icon: 'ClipboardListOutlined',
    entry: 'pages/demo/todos/index', permissions: ['demo:todos:list'], keywords: ['待办', '任务'],
  },
  {
    id: 'demo-region', backendModuleId: 'demo', name: '省市级联', icon: 'EnvironmentOutlined',
    entry: 'pages/demo/region/index', permissions: ['region:list'], keywords: ['省份', '城市', '地区'],
  },
]

for (const field of ['id', 'entry'] as const) {
  if (new Set(MOBILE_MODULES.map((module) => module[field])).size !== MOBILE_MODULES.length) {
    throw new Error(`Duplicate mobile module ${field}`)
  }
}

export function getMobileModuleById(id: string): MobileModule | undefined {
  return MOBILE_MODULES.find((module) => module.id === id)
}

export function getMobileModuleByPage(page: string | undefined): MobileModule | undefined {
  if (!page) return undefined
  const key = normalizePage(page)
  return MOBILE_MODULES.find((module) => module.entry === key)
}

export function isModuleEnabled(
  module: MobileModule,
  enabledModuleIds?: readonly string[] | null,
): boolean {
  return (
    module.backendModuleId === 'core' || Boolean(enabledModuleIds?.includes(module.backendModuleId))
  )
}

/** 工作台里启用的应用入口（服务端已按角色授权，这里只做展示层兜底）。 */
function visibleEntries(menus: readonly WorkbenchMenuNode[]): WorkbenchMenuNode[] {
  return menus.flatMap((group) =>
    group.type === 0 && group.status === '1'
      ? [...(group.children ?? [])].filter((entry) => entry.type === 1 && entry.status === '1')
      : [],
  )
}

export function isMobileModuleAuthorized(
  module: MobileModule,
  menus: readonly WorkbenchMenuNode[],
  permissions?: readonly string[],
  enabledModuleIds?: readonly string[] | null,
): boolean {
  return (
    module.implemented !== false &&
    module.showInWorkbench !== false &&
    isRegisteredPage(module.entry) &&
    hasRequiredPermissions(module.permissions, permissions) &&
    isModuleEnabled(module, enabledModuleIds) &&
    visibleEntries(menus).some((entry) => getMobileModuleByPage(entry.page)?.id === module.id)
  )
}

export function getAuthorizedMobileModules(
  menus: readonly WorkbenchMenuNode[],
  permissions?: readonly string[],
  enabledModuleIds?: readonly string[] | null,
): MobileModule[] {
  return getWorkbenchGroups(menus, permissions, enabledModuleIds).flatMap((group) =>
    group.apps.flatMap((app) => {
      const module = getMobileModuleById(app.id)
      return module ? [{ ...module, name: app.name, icon: app.icon }] : []
    }),
  )
}

export interface WorkbenchApp {
  id: string
  name: string
  icon: string
  menuId: number
  /** 已实现、已注册且当前可访问的移动端页面入口。 */
  entry: string
}

export interface WorkbenchAppGroup {
  id: string
  name: string
  apps: WorkbenchApp[]
}

/**
 * 工作台应用目录：分组与入口顺序、名称、图标均由后台「工作台配置」决定。
 * App 内没有对应已注册页面的入口不展示，权限不足的入口同样隐藏。
 */
export function getWorkbenchGroups(
  menus: readonly WorkbenchMenuNode[],
  permissions?: readonly string[],
  enabledModuleIds?: readonly string[] | null,
  query = '',
): WorkbenchAppGroup[] {
  const keyword = query.replace(/\s+/g, '').toLowerCase()
  const seen = new Set<string>()
  const result: WorkbenchAppGroup[] = []
  for (const group of menus) {
    if (group.type !== 0 || group.status !== '1') continue
    const apps: WorkbenchApp[] = []
    for (const entry of group.children ?? []) {
      if (entry.type !== 1 || entry.status !== '1') continue
      const module = getMobileModuleByPage(entry.page)
      if (!module || seen.has(module.id)) continue
      if (!isMobileModuleAuthorized(module, menus, permissions, enabledModuleIds)) continue
      const matches = [entry.name, module.name, ...(module.keywords ?? [])].some((value) =>
        value.replace(/\s+/g, '').toLowerCase().includes(keyword),
      )
      if (!matches) continue
      seen.add(module.id)
      apps.push({
        id: module.id,
        name: entry.name || module.name,
        icon: entry.icon || module.icon || 'AppstoreOutlined',
        menuId: entry.id,
        entry: module.entry,
      })
    }
    if (apps.length) result.push({ id: `group-${group.id}`, name: group.name, apps })
  }
  return result
}

export interface MobilePageAccess {
  module: MobileModule
  permissions: readonly string[]
  editUser?: boolean
}

const SECONDARY_MODULE_PAGES: Record<
  string,
  { moduleId: string; permissions?: readonly string[]; editUser?: boolean }
> = {
  'pages/contacts/dept/index': { moduleId: 'contacts', permissions: ['app:contacts:dept-users'] },
  'pages/system/user/detail/index': { moduleId: 'system-user' },
  'pages/system/user/edit/index': { moduleId: 'system-user', editUser: true },
  'pages/system/user/departments/index': { moduleId: 'system-user', permissions: ['system:department:list'] },
  'pages/system/user/roles/index': { moduleId: 'system-user', permissions: ['system:role:list'] },
  'pages/system/dept/detail/index': { moduleId: 'system-dept' },
  'pages/system/dept/form/index': { moduleId: 'system-dept' },
  'pages/system/dict/items/index': { moduleId: 'system-dict' },
  'pages/system/dict/detail/index': { moduleId: 'system-dict' },
  'pages/system/dict/form/index': { moduleId: 'system-dict' },
  'pages/system/dict/items/detail/index': { moduleId: 'system-dict' },
  'pages/system/dict/items/form/index': { moduleId: 'system-dict' },
  'pages/system/position/detail/index': { moduleId: 'system-position' },
  'pages/system/position/form/index': { moduleId: 'system-position' },
  'pages/system/role/detail/index': { moduleId: 'system-role' },
  'pages/system/role/form/index': {
    moduleId: 'system-role',
    permissions: ['system:role:update', 'system:role:grant'],
  },
  'pages/system/role/permissions/index': {
    moduleId: 'system-role',
    permissions: ['system:role:update', 'system:role:grant'],
  },
}

export function getModuleForPage(path: string): MobilePageAccess | undefined {
  const page = normalizePage(path)
  const direct = MOBILE_MODULES.find((module) => module.entry === page)
  if (direct) return { module: direct, permissions: direct.permissions }
  const secondary = SECONDARY_MODULE_PAGES[page]
  if (!secondary) return undefined
  const module = getMobileModuleById(secondary.moduleId)
  return module
    ? {
        module,
        permissions: secondary.permissions ?? module.permissions,
        editUser: secondary.editUser,
      }
    : undefined
}

export function getModuleForEntry(entry: string): MobileModule | undefined {
  return getModuleForPage(entry)?.module
}
