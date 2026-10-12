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
import { buildActionPermissionCodes, buildRoleAuthorization, flattenMenus } from '../permissions'

import styles from './permissions.module.scss'

const REQUIRED = ['system:role:update', 'system:role:grant']

/** 树上可见的节点：搜索时只保留命中节点及通向它的父级链。 */
interface VisibleNode {
  node: AdminMenu
  children: VisibleNode[]
}

function matches(node: AdminMenu, keyword: string): boolean {
  return [node.name, node.path ?? '', ...(node.permissionCodes || [])].some((text) =>
    text.toLowerCase().includes(keyword),
  )
}

function filterTree(nodes: readonly AdminMenu[], keyword: string): VisibleNode[] {
  return nodes.flatMap((node) => {
    const children = node.children || []
    // 命中节点带出整棵子树，搜到菜单后可以直接勾它的按钮
    if (!keyword || matches(node, keyword)) return [{ node, children: filterTree(children, '') }]
    const visible = filterTree(children, keyword)
    return visible.length > 0 ? [{ node, children: visible }] : []
  })
}

function descendantsOf(node: AdminMenu): AdminMenu[] {
  return (node.children || []).flatMap((child) => [child, ...descendantsOf(child)])
}

function RolePermissionsPage() {
  const guard = useRequireAuth({ moduleId: 'system-role' })
  const router = useRouter()
  const id = Number(router.params.id)
  const canSave = useCanWrite(...REQUIRED)

  const [menus, setMenus] = useState<AdminMenu[]>([])
  // 与 PC 授权树一致：目录、菜单、按钮的 id 同在一个勾选集合里
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [roleCodes, setRoleCodes] = useState<string[]>([])
  // 本次会话是否改动过按钮；没动过就不提交 permissionCodes，避免触发后端的授予校验
  const [actionsTouched, setActionsTouched] = useState(false)
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
        const codes = new Set(role.permissionCodes ?? [])
        const menuIds = new Set(role.menuIds ?? [])
        setMenus(tree ?? [])
        setRoleCodes(role.permissionCodes ?? [])
        setActionsTouched(false)
        // 按钮"勾选" = 它的任一权限码已授予角色
        setSelected(
          new Set(
            flattenMenus(tree ?? [])
              .filter((node) =>
                node.type === 2
                  ? (node.permissionCodes || []).some((code) => codes.has(code))
                  : menuIds.has(node.id),
              )
              .map((node) => node.id),
          ),
        )
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

  const nodes = useMemo(() => flattenMenus(menus), [menus])
  const visible = useMemo(() => filterTree(menus, keyword.trim().toLowerCase()), [menus, keyword])
  const menuCount = nodes.filter((node) => node.type !== 2 && selected.has(node.id)).length
  const actionCount = nodes.filter((node) => node.type === 2 && selected.has(node.id)).length

  // 父子联动（与 PC 默认一致）：勾选/取消连同全部后代（含按钮），子节点不反推父节点
  const toggle = (node: AdminMenu) => {
    const checked = !selected.has(node.id)
    const affected = [node, ...descendantsOf(node)]
    if (affected.some((item) => item.type === 2 && selected.has(item.id) !== checked)) {
      setActionsTouched(true)
    }
    setSelected((previous) => {
      const next = new Set(previous)
      for (const item of affected) {
        if (checked) next.add(item.id)
        else next.delete(item.id)
      }
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
      // 本页管菜单与功能授权，永远不提交 appMenuIds。后端对缺省字段不做修改，
      // 带上空数组会清空对应授权；permissionCodes 只在动过按钮时才提交。
      const { menuIds } = buildRoleAuthorization(
        { menuIds: [...selected], permissionCodes: [], appMenuIds: [] },
        menus,
        [],
      )
      await adminRoleApi.updateAdminRole(
        id,
        actionsTouched
          ? { menuIds, permissionCodes: buildActionPermissionCodes(roleCodes, menus, selected) }
          : { menuIds },
      )
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

  const renderNode = ({ node, children }: VisibleNode, bordered: boolean, depth = 0) => {
    const checked = selected.has(node.id)
    // 按钮第二行显示权限码，目录/菜单显示 path
    const note = node.type === 2 ? (node.permissionCodes || []).join(', ') : node.path
    return (
      <View key={node.id}>
        <View
          className={[
            styles.node,
            bordered && styles.nodeBordered,
            depth === 1 && styles['node--child'],
            depth >= 2 && styles['node--grandchild'],
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={() => toggle(node)}
          hoverClass={styles['node:hover']}
          aria-label={node.name}
        >
          <Checkbox checked={checked} />
          <View className={styles.node__body}>
            <Text className={styles.node__name}>{node.name}</Text>
            {note ? <Text className={styles.node__path}>{note}</Text> : null}
          </View>
        </View>
        {children.map((child, index) => renderNode(child, index < children.length - 1, depth + 1))}
      </View>
    )
  }

  return (
    <ManagementPage className="page-container">
      {process.env.TARO_ENV === 'h5' ? <PageHeader title="功能授权" /> : null}
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
          {visible.map((item) => (
            // 每个顶级分组一张独立卡片，避免单个超高大圆角容器
            <View className={styles.group} key={item.node.id}>
              {renderNode(item, false)}
            </View>
          ))}
        </ManagementStates>
        {kind === 'ready' ? (
          <Text className={styles.group__title}>
            {`已选 ${menuCount} 个菜单，${actionCount} 项操作`}
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
