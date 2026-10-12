import { Text, View } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as adminRoleApi from '@/api/admin/role'
import * as adminMenuApi from '@/api/admin/menu'
import type { AdminMenu } from '@/api/admin/menu'
import { getSessionVersion } from '@/api/client'
import {
  Checkbox,
  FormSubmitBar,
  ManagementFilterBar,
  ManagementPage,
  ManagementSearchBar,
  ManagementStates,
} from '@/components/management'
import { PageHeader } from '@/components/molecules'
import { useCanWrite } from '@/hooks'
import { canWriteModuleNow, useRequireAuth } from '@/utils/auth-guard'
import { navigateBack } from '@/utils/router'
import { withAccountScope } from '../../_shared/AdminUI'
import { buildRoleAuthorization, flattenMenus } from '../permissions'

import styles from './permissions.module.scss'

const REQUIRED = ['system:role:update', 'system:role:grant']

/** 只勾选目录与菜单（type 0/1），按钮权限交给 permissionCodes。 */
function selectableNodes(menus: readonly AdminMenu[]): AdminMenu[] {
  return flattenMenus(menus).filter((node) => node.type === 0 || node.type === 1)
}

function matches(node: AdminMenu, keyword: string): boolean {
  return (
    node.name.toLowerCase().includes(keyword) || (node.path ?? '').toLowerCase().includes(keyword)
  )
}

function RolePermissionsPage() {
  const guard = useRequireAuth({ moduleId: 'system-role' })
  const router = useRouter()
  const id = Number(router.params.id)
  const canSave = useCanWrite(...REQUIRED)

  const [menus, setMenus] = useState<AdminMenu[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [keyword, setKeyword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const loadSequence = useRef(0)

  useEffect(() => {
    if (!guard.ready || !guard.allowed) return
    const sequence = ++loadSequence.current
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const [tree, role] = await Promise.all([
          adminMenuApi.getAdminMenuTree(),
          adminRoleApi.getAdminRole(id),
        ])
        if (sequence !== loadSequence.current) return
        setMenus(tree ?? [])
        setSelected(new Set(role.menuIds ?? []))
      } catch (e) {
        if (sequence === loadSequence.current) {
          setError(e instanceof Error ? e.message : '加载失败')
        }
      } finally {
        if (sequence === loadSequence.current) setLoading(false)
      }
    })()
    return () => {
      loadSequence.current++
    }
  }, [id, guard.ready, guard.allowed])

  const nodes = useMemo(() => selectableNodes(menus), [menus])
  const byId = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes])
  const childrenOf = useMemo(() => {
    const map = new Map<number, AdminMenu[]>()
    for (const node of nodes) {
      const key = node.parentId ?? 0
      const list = map.get(key) ?? []
      list.push(node)
      map.set(key, list)
    }
    return map
  }, [nodes])

  const visible = useMemo(() => {
    const query = keyword.trim().toLowerCase()
    if (!query) return nodes.filter((node) => node.type === 0)
    return nodes.filter((node) => matches(node, query))
  }, [nodes, keyword])

  const childNodesOf = (parent: AdminMenu): AdminMenu[] =>
    (childrenOf.get(parent.id) ?? []).filter((node) => {
      if (!keyword.trim()) return true
      const query = keyword.trim().toLowerCase()
      return matches(node, query) || matches(parent, query)
    })

  const toggle = (node: AdminMenu) => {
    setSelected((previous) => {
      const next = new Set(previous)
      if (next.has(node.id)) next.delete(node.id)
      else next.add(node.id)
      return next
    })
  }

  const handleSubmit = async () => {
    if (submittingRef.current) return
    if (!canWriteModuleNow('system-role', REQUIRED)) return
    submittingRef.current = true
    setSubmitting(true)
    const session = getSessionVersion()
    try {
      // 本页只管菜单授权：只提交 menuIds。后端对缺省字段不做修改，
      // 带上空的 permissionCodes / appMenuIds 会清空角色的功能与工作台授权。
      const { menuIds } = buildRoleAuthorization(
        { menuIds: [...selected], permissionCodes: [], appMenuIds: [] },
        menus,
        [],
      )
      await adminRoleApi.updateAdminRole(id, { menuIds })
      if (session !== getSessionVersion()) return
      Taro.showToast({ title: '权限已保存', icon: 'success' })
      setTimeout(() => navigateBack(1), 600)
    } catch (e) {
      if (session === getSessionVersion()) {
        Taro.showToast({ title: e instanceof Error ? e.message : '保存失败', icon: 'none' })
      }
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  if (!guard.ready || !guard.allowed) return <ManagementPage className="page-container">{null}</ManagementPage>

  const kind = error ? 'error' : loading ? 'loading' : visible.length === 0 ? 'empty' : 'ready'

  const renderNode = (node: AdminMenu, bordered: boolean, child = false) => {
    const checked = selected.has(node.id)
    const children = childNodesOf(node)
    return (
      <View key={node.id}>
        <View
          className={[styles.node, bordered && styles.nodeBordered, child && styles['node--child']]
            .filter(Boolean)
            .join(' ')}
          onClick={() => toggle(node)}
          hoverClass={styles['node:hover']}
          aria-label={node.name}
        >
                    <Checkbox checked={checked} />
          <View className={styles.node__body}>
            <Text className={styles.node__name}>{node.name}</Text>
            {node.path ? <Text className={styles.node__path}>{node.path}</Text> : null}
          </View>
        </View>
        {children.map((childNode, index) =>
          renderNode(childNode, index < children.length - 1, true),
        )}
      </View>
    )
  }

  return (
    <ManagementPage className="page-container">
      {process.env.TARO_ENV === 'h5' ? <PageHeader title="配置权限" /> : null}
      <ManagementFilterBar>
        <ManagementSearchBar value={keyword} onChange={setKeyword} placeholder="搜索权限" />
      </ManagementFilterBar>

      <View className={styles.content}>
        <ManagementStates
          kind={kind}
          emptyText={keyword ? '未找到相关权限' : '暂无可配置权限'}
          errorText="加载失败，请重试"
          onRetry={() => setError(null)}
        >
          {visible.map((node) => (
            // 每个顶级分组一张独立卡片，避免单个超高大圆角容器
            <View className={styles.group} key={node.id}>
              {renderNode(node, false)}
            </View>
          ))}
        </ManagementStates>
        {kind === 'ready' ? (
          <Text className={styles.group__title}>
            已选 {selected.size} 项 / 共 {byId.size} 项
          </Text>
        ) : null}
      </View>

      {canSave && kind === 'ready' ? (
        <FormSubmitBar
          text="保存权限"
          submitting={submitting}
          onSubmit={() => void handleSubmit()}
        />
      ) : null}
    </ManagementPage>
  )
}

export default withAccountScope(RolePermissionsPage)
