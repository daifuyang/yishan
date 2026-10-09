import type { SysMenuNode } from '@/api/types'
import { isRegisteredPage } from '@/constants/page-config'

/** 实际移动端页面注册；尚未适配的菜单由工作台展示占位入口。 */
export interface MobileModule {
  id: string
  name: string
  icon: string
  entry: string
  backendMenuPath: string
  backendModuleId: string
  permissions: readonly string[]
  category: string
  sort: number
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
    backendMenuPath: '/contacts',
    permissions: ['app:contacts:dept-tree'],
    category: '常用',
    sort: 10,
    keywords: ['contacts', '成员'],
  },
  {
    id: 'system-user',
    backendModuleId: 'core',
    name: '用户管理',
    icon: 'UserOutlined',
    entry: 'pages/system/user/index',
    backendMenuPath: '/system/user',
    permissions: ['system:user:list'],
    category: '系统管理',
    sort: 20,
    keywords: ['user'],
  },
  {
    id: 'system-dept',
    backendModuleId: 'core',
    name: '部门管理',
    icon: 'ApartmentOutlined',
    entry: 'pages/system/dept/index',
    backendMenuPath: '/system/department',
    permissions: ['system:department:list'],
    category: '系统管理',
    sort: 30,
    implemented: false,
  },
  {
    id: 'system-login-log',
    backendModuleId: 'core',
    name: '登录日志',
    icon: 'AuditOutlined',
    entry: 'pages/system/login-log/index',
    backendMenuPath: '/system/login-log',
    permissions: ['system:login-log:list'],
    category: '系统管理',
    sort: 40,
    implemented: false,
  },
  {
    id: 'system-dict',
    backendModuleId: 'core',
    name: '字典管理',
    icon: 'BookOutlined',
    entry: 'pages/system/dict/index',
    backendMenuPath: '/system/dict',
    permissions: ['system:dict:list'],
    category: '系统管理',
    sort: 50,
    implemented: false,
  },
]

for (const field of ['id', 'entry'] as const) {
  if (new Set(MOBILE_MODULES.map((module) => module[field])).size !== MOBILE_MODULES.length) {
    throw new Error(`Duplicate mobile module ${field}`)
  }
}

export function normalizePage(path: string): string {
  return path.split('?')[0].replace(/^\/+/, '').replace(/\/+$/, '')
}

export function flattenMenus(menus: readonly SysMenuNode[]): SysMenuNode[] {
  const result: SysMenuNode[] = []
  const walk = (nodes: readonly SysMenuNode[]) => {
    for (const node of nodes) {
      result.push(node)
      if (node.children?.length) walk(node.children)
    }
  }
  walk(menus)
  return result
}

export function getMobileModuleById(id: string): MobileModule | undefined {
  return MOBILE_MODULES.find((module) => module.id === id)
}

export function getMobileModule(menu: SysMenuNode): MobileModule | undefined {
  if (menu.type !== 1 || menu.isExternalLink || !menu.path) return undefined
  return MOBILE_MODULES.find(
    (module) => normalizePage(module.backendMenuPath) === normalizePage(menu.path ?? ''),
  )
}

export function hasRequiredPermissions(
  required: readonly string[],
  permissions?: readonly string[],
): boolean {
  return permissions !== undefined && required.every((code) => permissions.includes(code))
}

export function isModuleEnabled(
  module: MobileModule,
  enabledModuleIds?: readonly string[] | null,
): boolean {
  return (
    module.backendModuleId === 'core' || Boolean(enabledModuleIds?.includes(module.backendModuleId))
  )
}

export function isMobileModuleAuthorized(
  module: MobileModule,
  menus: readonly SysMenuNode[],
  permissions?: readonly string[],
  enabledModuleIds?: readonly string[] | null,
): boolean {
  if (
    module.implemented === false ||
    module.showInWorkbench === false ||
    !isRegisteredPage(module.entry)
  )
    return false
  const visibleMenus: SysMenuNode[] = []
  const visit = (nodes: readonly SysMenuNode[]) => {
    for (const menu of nodes) {
      if (menu.type === 2 || menu.status !== '1' || menu.hideInMenu || menu.isExternalLink) continue
      visibleMenus.push(menu)
      if (menu.children?.length) visit(menu.children)
    }
  }
  visit(menus)
  return (
    hasRequiredPermissions(module.permissions, permissions) &&
    isModuleEnabled(module, enabledModuleIds) &&
    visibleMenus.some((menu) => getMobileModule(menu)?.id === module.id)
  )
}

export function getAuthorizedMobileModules(
  menus: readonly SysMenuNode[],
  permissions?: readonly string[],
  enabledModuleIds?: readonly string[] | null,
): MobileModule[] {
  return getWorkbenchGroups(menus, permissions, enabledModuleIds).flatMap((group) =>
    group.apps.flatMap((app) => {
      const module = getMobileModuleById(app.id)
      return module && isMobileModuleAuthorized(module, menus, permissions, enabledModuleIds)
        ? [{ ...module, name: app.name, icon: app.icon }]
        : []
    }),
  )
}

export interface WorkbenchApp {
  id: string
  name: string
  icon: string
  menuId: number
  /** 只有已实现、已注册且当前可访问的移动端入口才有路由。 */
  entry?: string
}

export interface WorkbenchAppGroup {
  id: string
  name: string
  apps: WorkbenchApp[]
}

export function getWorkbenchGroups(
  menus: readonly SysMenuNode[],
  permissions?: readonly string[],
  enabledModuleIds?: readonly string[] | null,
  query = '',
): WorkbenchAppGroup[] {
  const groups = new Map<string, WorkbenchAppGroup>()
  const seen = new Set<string>()
  const keyword = query.replace(/\s+/g, '').toLowerCase()
  const visit = (nodes: readonly SysMenuNode[], category?: { id: string; name: string }) => {
    for (const menu of [...nodes].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)) {
      if (menu.type === 2 || menu.status !== '1' || menu.hideInMenu || menu.isExternalLink) continue
      const parent =
        category ?? (menu.type === 0 ? { id: `menu-${menu.id}`, name: menu.name } : undefined)
      const module = getMobileModule(menu)
      const menuKey = menu.path ? normalizePage(menu.path) : ''
      if (menu.type === 1 && menuKey && !seen.has(menuKey) && module?.showInWorkbench !== false) {
        seen.add(menuKey)
        const name = menu.name || module?.name || '应用'
        const matches = [name, module?.name ?? '', ...(module?.keywords ?? [])].some((value) =>
          value.replace(/\s+/g, '').toLowerCase().includes(keyword),
        )
        if (matches) {
          const groupKey = parent?.id ?? `category-${module?.category ?? 'other'}`
          const group = groups.get(groupKey) ?? {
            id: groupKey,
            name: parent?.name ?? module?.category ?? '其他应用',
            apps: [],
          }
          group.apps.push({
            id: module?.id ?? `menu-${menu.id}`,
            name,
            icon: menu.icon || module?.icon || menu.path || 'AppstoreOutlined',
            menuId: menu.id,
            entry:
              module && isMobileModuleAuthorized(module, menus, permissions, enabledModuleIds)
                ? module.entry
                : undefined,
          })
          groups.set(groupKey, group)
        }
      }
      if (menu.children?.length) visit(menu.children, parent)
    }
  }
  visit(menus)
  return [...groups.values()]
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
  'pages/system/dept/detail/index': { moduleId: 'system-dept' },
  'pages/system/dict/items/index': { moduleId: 'system-dict' },
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
