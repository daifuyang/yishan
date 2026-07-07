import { useState, useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'

import { AppText } from '@/components/atoms'
import { WorkbenchGrid, TabBar, WorkbenchUserPanel, type WorkbenchGroup } from '@/components/organisms'
import { StateView } from '@/components/feedback'
import { menuApi } from '@/api'
import { useRequireAuth } from '@/utils/auth-guard'
import { useCanWrite } from '@/hooks'
import { navigateTo, switchTab } from '@/utils/router'
import { TAB_PAGES, PERMS, SYSTEM_PAGES } from '@/constants/routes'
import { resolveMenuRoute } from '@/constants/menu-routes'
import { fallbackIconChar, mapMenuIcon } from '@/utils/menu-icon'
import type { SysMenuNode } from '@/api/types'

import styles from './index.module.scss'

const ICON_FALLBACK = '·'

function renderIcon(name?: string): React.ReactNode {
  const mapped = mapMenuIcon(name)
  if (mapped) {
    return <Text className={styles.apps__icon}>{mapped}</Text>
  }
  return <Text className={styles.apps__icon}>{fallbackIconChar(name) || ICON_FALLBACK}</Text>
}

function buildGroups(menus: SysMenuNode[]): WorkbenchGroup[] {
  // 1. 索引所有节点（含 type=0 目录）按 id
  const byId = new Map<number, SysMenuNode>()
  const walk = (nodes: SysMenuNode[]) => {
    for (const n of nodes) {
      byId.set(n.id, n)
      if (n.children && n.children.length > 0) walk(n.children)
    }
  }
  walk(menus || [])

  // 2. 只挑要展示的叶子：type=1（菜单）、hideInMenu=false、status='1'
  const leaves = Array.from(byId.values())
    .filter((m) => m.type === 1 && !m.hideInMenu && m.status === '1')
    .sort((a, b) => a.sort_order - b.sort_order)

  // 3. 按父节点分组
  //    - 父 type=0（目录）→ 用目录名做 group title
  //    - 父不存在 / 父就是 type=1（孤儿）→ 进"应用"兜底组
  const groupsByParent = new Map<number, { title: string; sortOrder: number; items: SysMenuNode[] }>()
  const orphans: SysMenuNode[] = []
  for (const leaf of leaves) {
    const parent = leaf.parentId ? byId.get(leaf.parentId) : null
    if (parent && parent.type === 0) {
      const g = groupsByParent.get(parent.id) ?? {
        title: parent.name,
        sortOrder: parent.sort_order,
        items: [],
      }
      g.items.push(leaf)
      groupsByParent.set(parent.id, g)
    } else {
      orphans.push(leaf)
    }
  }

  const result: WorkbenchGroup[] = []
  const orderedParents = Array.from(groupsByParent.values()).sort(
    (a, b) => a.sortOrder - b.sortOrder,
  )
  for (const g of orderedParents) {
    result.push({
      key: `dir-${g.title}`,
      title: g.title,
      bordered: false,
      columns: 4,
      items: g.items.map((c) => ({
        key: String(c.id),
        icon: renderIcon(c.icon),
        label: c.name,
      })),
    })
  }
  if (orphans.length > 0) {
    result.push({
      key: 'orphans',
      title: '应用',
      bordered: false,
      columns: 4,
      items: orphans.map((c) => ({
        key: String(c.id),
        icon: renderIcon(c.icon),
        label: c.name,
      })),
    })
  }
  return result
}

export default function AppsPage() {
  const [groups, setGroups] = useState<WorkbenchGroup[]>([])
  const [flatMenus, setFlatMenus] = useState<SysMenuNode[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userPanelExpanded, setUserPanelExpanded] = useState(false)

  const canViewUser = useCanWrite(PERMS.userList)

  useRequireAuth()

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await menuApi.getAuthorizedMenuTree()
      const flat: SysMenuNode[] = []
      const walk = (nodes: SysMenuNode[]) => {
        for (const n of nodes) {
          flat.push(n)
          if (n.children && n.children.length > 0) walk(n.children)
        }
      }
      walk(data || [])
      setFlatMenus(flat)
      setGroups(buildGroups(data || []))
    } catch (e) {
      setError((e as Error).message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  useDidShow(() => {
    load()
  })

  const isUserMenu = (menu: SysMenuNode) => {
    const name = menu.name?.toLowerCase() || ''
    const path = menu.path?.toLowerCase() || ''
    const perm = menu.perm?.toLowerCase() || ''
    return (
      name === '用户管理' ||
      path === '/system/user' ||
      perm === 'system:user:list' ||
      perm === 'system:user:write' ||
      perm === 'system:user:delete'
    )
  }

  const handleItem = (key: string) => {
    const menu = flatMenus.find((m) => String(m.id) === key)
    if (!menu) {
      Taro.showToast({ title: '该功能待实现', icon: 'none' })
      return
    }

    if (isUserMenu(menu) && canViewUser) {
      navigateTo(`/${SYSTEM_PAGES.userIndex}`)
      return
    }

    const route = resolveMenuRoute(menu)
    if (route.type === 'page') {
      navigateTo(route.url)
    } else if (route.type === 'tab') {
      switchTab(route.url)
    } else {
      Taro.showToast({ title: '该功能待实现', icon: 'none' })
    }
  }

  const handleUserPanelToggle = () => {
    setUserPanelExpanded((prev) => !prev)
  }

  const kind: 'loading' | 'error' | 'empty' | 'ready' = error
    ? 'error'
    : loading && groups.length === 0
      ? 'loading'
      : groups.length === 0
        ? 'empty'
        : 'ready'

  return (
    <View className={`page-container ${styles.apps}`}>
      <View className={styles.apps__header}>
        <AppText size={20} weight="semibold">
          应用
        </AppText>
        <AppText size={13} variant="tertiary">
          当前角色已授权功能
        </AppText>
      </View>

      <StateView
        kind={kind}
        text={error || (kind === 'empty' ? '暂无可用应用' : undefined)}
        onRetry={load}
        minHeight={300}
      >
        {canViewUser && (
          <WorkbenchUserPanel
            expanded={userPanelExpanded}
            onToggle={handleUserPanelToggle}
          />
        )}
        <WorkbenchGrid groups={groups} onItemClick={handleItem} />
      </StateView>

      <TabBar currentPath={TAB_PAGES.apps} />
    </View>
  )
}
