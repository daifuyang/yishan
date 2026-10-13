import Taro, { useRouter } from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  getAdminMenu,
  getAdminPermissionCatalog,
  updateAdminMenu,
  type AdminPermission,
} from '@/api/admin/menu'
import { getSessionVersion } from '@/api/client'
import {
  Checkbox,
  FormSubmitBar,
  ManagementFilterBar,
  ManagementPage,
  ManagementPageHeader,
  ManagementSearchBar,
  ManagementStates,
} from '@/components/management'
import { useCanWrite } from '@/hooks'
import { canWriteModuleNow, useRequireAuth } from '@/utils/auth-guard'
import { navigateBack } from '@/utils/router'
import { errorMessage, withAccountScope } from '@/utils/account-scope'
import styles from './index.module.scss'

const REQUIRED = ['system:menu:update', 'system:permission:catalog']

function matches(item: AdminPermission, keyword: string): boolean {
  return `${item.label} ${item.code}`.toLowerCase().includes(keyword)
}

/**
 * 菜单的关联功能（权限点）配置。
 *
 * 从编辑菜单里拆出来的原因：功能目录动辄几十项，铺在编辑页里会把一张
 * 「改菜单属性」的表单撑成长表单，而且两种职责混在一起后，用户改完菜单名
 * 顺手点保存，很容易把没细看的权限关联一起提交掉。
 */
function MenuPermissionsPage() {
  const guard = useRequireAuth({ moduleId: 'system-menu' })
  const id = Number(useRouter().params.id)
  const validId = Number.isInteger(id) && id > 0
  const canSave = useCanWrite(...REQUIRED)

  const [catalog, setCatalog] = useState<AdminPermission[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const loadSequence = useRef(0)
  const session = useRef(getSessionVersion()).current

  useEffect(() => {
    if (!guard.ready || !guard.allowed || !validId) {
      setLoading(false)
      return
    }
    const sequence = ++loadSequence.current
    void (async () => {
      setLoading(true)
      setError('')
      try {
        const [menu, permissions] = await Promise.all([
          getAdminMenu(id),
          getAdminPermissionCatalog(),
        ])
        if (sequence !== loadSequence.current || session !== getSessionVersion()) return
        setSelected(new Set(menu.permissionCodes ?? []))
        setCatalog(permissions ?? [])
      } catch (cause) {
        if (sequence === loadSequence.current) setError(errorMessage(cause))
      } finally {
        if (sequence === loadSequence.current) setLoading(false)
      }
    })()
    return () => {
      loadSequence.current++
    }
  }, [id, validId, guard.ready, guard.allowed, session])

  const visible = useMemo(() => {
    const needle = keyword.trim().toLowerCase()
    if (!catalog) return []
    return needle ? catalog.filter((item) => matches(item, needle)) : catalog
  }, [catalog, keyword])

  const toggle = (code: string) =>
    setSelected((previous) => {
      const next = new Set(previous)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })

  async function handleSubmit() {
    if (submittingRef.current || !canWriteModuleNow('system-menu', REQUIRED)) return
    submittingRef.current = true
    setSubmitting(true)
    const current = session
    try {
      // 只提交 permissionCodes：后端对未传字段保留原值，不会误清其他菜单属性
      await updateAdminMenu(id, { permissionCodes: [...selected] })
      if (current !== getSessionVersion()) return
      void Taro.showToast({ title: '已保存', icon: 'success' })
      navigateBack(1)
    } catch (cause) {
      if (current === getSessionVersion())
        void Taro.showToast({ title: errorMessage(cause), icon: 'none' })
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  if (!guard.ready || !guard.allowed) return <ManagementPage>{null}</ManagementPage>
  if (!validId) {
    return (
      <ManagementPage>
        <ManagementStates kind="error" errorText="菜单参数无效" />
      </ManagementPage>
    )
  }

  const kind = error ? 'error' : loading ? 'loading' : visible.length === 0 ? 'empty' : 'ready'

  return (
    <ManagementPage>
      {process.env.TARO_ENV === 'h5' ? <ManagementPageHeader title="关联功能" /> : null}
      <ManagementFilterBar>
        <ManagementSearchBar
          value={keyword}
          onChange={setKeyword}
          placeholder="搜索功能名称或编码"
        />
      </ManagementFilterBar>
      <View className={styles.content}>
        <ManagementStates
          kind={kind}
          errorText={error || undefined}
          emptyText={keyword ? '未找到匹配的功能' : '暂无可关联的功能'}
          onRetry={() => setError('')}
        >
          <View className={styles.list}>
            {visible.map((item, index) => (
              <View
                key={item.code}
                className={[
                  styles.row,
                  index < visible.length - 1 && styles.rowBordered,
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => toggle(item.code)}
                hoverClass={styles.rowHover}
                aria-label={item.label}
              >
                <View className={styles.row__text}>
                  <Text className={styles.row__label}>{item.label}</Text>
                  <Text className={styles.row__code}>{item.code}</Text>
                </View>
                <Checkbox checked={selected.has(item.code)} aria-label={item.label} />
              </View>
            ))}
          </View>
        </ManagementStates>
        {kind === 'ready' ? (
          <Text className={styles.summary}>
            已选 {selected.size} 项 / 共 {catalog?.length ?? 0} 项
          </Text>
        ) : null}
      </View>
      {canSave && kind === 'ready' ? (
        <FormSubmitBar text="保存" submitting={submitting} onSubmit={() => void handleSubmit()} />
      ) : null}
    </ManagementPage>
  )
}
export default withAccountScope(MenuPermissionsPage)
