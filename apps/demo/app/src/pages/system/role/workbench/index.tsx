import { Text, View } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import * as adminRoleApi from '@/api/admin/role'
import * as adminAppMenuApi from '@/api/admin/appMenu'
import type { AdminAppMenu } from '@/api/admin/appMenu'
import { getSessionVersion } from '@/api/client'
import { Checkbox, FormSubmitBar, ManagementPage, ManagementStates } from '@/components/management'
import { PageHeader } from '@/components/molecules'
import { useCanWrite } from '@/hooks'
import { canWriteModuleNow, useRequireAuth } from '@/utils/auth-guard'
import { navigateBack } from '@/utils/router'
import { withAccountScope } from '../../_shared/AdminUI'
import { buildRoleAuthorization } from '../permissions'

// 与「功能授权」页同一套视觉
import styles from '../permissions/permissions.module.scss'

const REQUIRED = ['system:role:update', 'system:role:grant']

function displayName(node: AdminAppMenu): string {
  return node.status === '1' ? node.name : `${node.name}（已禁用）`
}

function RoleWorkbenchPage() {
  const guard = useRequireAuth({ moduleId: 'system-role' })
  const router = useRouter()
  const id = Number(router.params.id)
  const canSave = useCanWrite(...REQUIRED)

  const [groups, setGroups] = useState<AdminAppMenu[]>([])
  // 只存入口 id；分组 id 在保存时由 buildRoleAuthorization 补全
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
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
          adminAppMenuApi.getAdminAppMenuTree(),
          adminRoleApi.getAdminRole(id),
        ])
        if (sequence !== loadSequence.current) return
        const entryIds = new Set(
          (tree ?? []).flatMap((group) => (group.children || []).map((entry) => entry.id)),
        )
        setGroups(tree ?? [])
        setSelected(new Set((role.appMenuIds ?? []).filter((menuId) => entryIds.has(menuId))))
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

  const visible = groups.filter((group) => (group.children || []).length > 0)

  const toggle = (entry: AdminAppMenu) => {
    setSelected((previous) => {
      const next = new Set(previous)
      if (next.has(entry.id)) next.delete(entry.id)
      else next.add(entry.id)
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
      // 本页只管工作台授权：只提交 appMenuIds，菜单与功能授权保持不变。
      const { appMenuIds } = buildRoleAuthorization(
        { menuIds: [], permissionCodes: [], appMenuIds: [...selected] },
        [],
        groups,
      )
      await adminRoleApi.updateAdminRole(id, { appMenuIds })
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

  return (
    <ManagementPage className="page-container">
      {process.env.TARO_ENV === 'h5' ? <PageHeader title="App 工作台" /> : null}

      <View className={styles.content}>
        <ManagementStates
          kind={kind}
          emptyText="暂无可配置入口"
          errorText="加载失败，请重试"
          onRetry={() => setError(null)}
        >
          {visible.map((group) => {
            const entries = group.children || []
            return (
              <View className={styles.group} key={group.id}>
                <Text className={styles.group__title}>{displayName(group)}</Text>
                {entries.map((entry, index) => (
                  <View
                    key={entry.id}
                    className={[styles.node, index < entries.length - 1 && styles.nodeBordered]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => toggle(entry)}
                    hoverClass={styles['node:hover']}
                    aria-label={entry.name}
                  >
                    <Checkbox checked={selected.has(entry.id)} />
                    <View className={styles.node__body}>
                      <Text className={styles.node__name}>{displayName(entry)}</Text>
                      {entry.page ? <Text className={styles.node__path}>{entry.page}</Text> : null}
                    </View>
                  </View>
                ))}
              </View>
            )
          })}
        </ManagementStates>
        {kind === 'ready' ? (
          <Text className={styles.group__title}>{`已选 ${selected.size} 个入口`}</Text>
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

export default withAccountScope(RoleWorkbenchPage)
