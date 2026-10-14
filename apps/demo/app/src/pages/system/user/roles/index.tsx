import { useMemo, useState } from 'react'
import { Input, Text, View } from '@tarojs/components'
import { useDidShow, useRouter } from '@tarojs/taro'

import { adminRoleApi } from '@/api'
import type { AdminRole } from '@/api/admin/types'
import { Checkbox, SelectionFooter } from '@/components/management'
import { StateView } from '@/components/feedback'
import { useRequireAuth } from '@/utils/auth-guard'
import { navigateBack } from '@/utils/router'
import { DRAFT_KEYS, useSelectionDraft } from '@/stores/selectionDraft'
import styles from './index.module.scss'

function parseIds(raw?: string): number[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0)
}

export default function UserRolesPage() {
  const guard = useRequireAuth({ moduleId: 'system-user' })
  const { params } = useRouter()
  const readonly = params.mode === 'readonly'

  const readDraft = useSelectionDraft((state) => state.readDraft)
  const writeDraft = useSelectionDraft((state) => state.writeDraft)

  const [roles, setRoles] = useState<AdminRole[] | null>(null)
  const [error, setError] = useState<string | undefined>()
  const [loaded, setLoaded] = useState(false)
  const [keyword, setKeyword] = useState('')

  // 草稿优先于 ?ids=：草稿来自本次编辑会话，URL 只用于无草稿时的深链进入
  const initial = useMemo(() => {
    const drafted = readDraft(DRAFT_KEYS.userRoles)
    return drafted.length ? drafted : parseIds(params.ids)
  }, [])

  const [selected, setSelected] = useState<number[]>(initial)

  // 抽成可调用函数：StateView 的「重试」不会让 useDidShow 再次触发，
  // 重试必须由页面自己重新发起请求，否则会永久卡在错误态。
  const load = () => {
    setError(undefined)
    void (async () => {
      try {
        const all: AdminRole[] = []
        let page = 1
        for (;;) {
          const result = await adminRoleApi.listAdminRoles({ page, pageSize: 100 })
          all.push(...result.data)
          if (page >= result.pagination.totalPages || !result.data.length) break
          page += 1
        }
        setRoles(all)
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败')
      }
    })()
  }

  useDidShow(() => {
    if (loaded) return
    setLoaded(true)
    load()
  })

  const visible = useMemo(() => {
    const kw = keyword.trim()
    if (!kw) return roles ?? []
    return (roles ?? []).filter((role) => role.name.includes(kw))
  }, [roles, keyword])

  const selectedItems = useMemo(
    () =>
      selected
        .map((id) => {
          const role = (roles ?? []).find((r) => r.id === id)
          return role ? { id, label: role.name, path: [] as string[] } : null
        })
        .filter((item): item is { id: number; label: string; path: string[] } => item !== null),
    [selected, roles],
  )

  const handleConfirm = () => {
    // 只读浏览不得写草稿，否则会污染正在编辑的会话
    if (!readonly) writeDraft(DRAFT_KEYS.userRoles, selected)
    navigateBack()
  }

  if (!guard.ready || !guard.allowed) {
    return (
      <View className="page-container">
        <StateView kind="empty" text="无访问权限" />
      </View>
    )
  }

  return (
    <View className={styles.page}>
      {process.env.TARO_ENV !== 'h5' ? <View className={styles.header}>
        <Text className={styles.title}>选择角色</Text>
      </View> : null}

      <View className={styles.search}>
        <Input
          className={styles.searchInput}
          value={keyword}
          placeholder="搜索角色名称"
          onInput={(event) => setKeyword(event.detail.value)}
        />
      </View>

      <StateView
        kind={error ? 'error' : loaded && !roles ? 'loading' : 'ready'}
        text={error}
        onRetry={load}
      >
        <View className={styles.list}>
          {visible.length === 0 ? (
            <Text className={styles.empty}>{keyword.trim() ? '没有匹配的角色' : '暂无可分配角色'}</Text>
          ) : (
            visible.map((role) => {
              const checked = selected.includes(role.id)
              return (
                <View
                  key={role.id}
                  className={styles.roleRow}
                  aria-label={`角色-${role.name}`}
                  aria-checked={readonly ? undefined : checked}
                  hoverClass={readonly ? undefined : styles['roleRow--hover']}
                  onClick={
                    readonly
                      ? undefined
                      : () =>
                          setSelected((prev) =>
                            prev.includes(role.id)
                              ? prev.filter((x) => x !== role.id)
                              : [...prev, role.id],
                          )
                  }
                >                  <Checkbox checked={checked} disabled={readonly} />
                  <Text className={styles.roleName}>{role.name}</Text>
                </View>
              )
            })
          )}
        </View>
      </StateView>

      <SelectionFooter
        count={selected.length}
        unit="个角色"
        items={selectedItems}
        readonly={readonly}
        onCancel={() => navigateBack()}
        onConfirm={handleConfirm}
        onRemoveItem={(id) => setSelected((prev) => prev.filter((x) => x !== id))}
      />
    </View>
  )
}
