import { useMemo, useState } from 'react'
import { Input, Text, View } from '@tarojs/components'
import { useDidShow, useRouter } from '@tarojs/taro'

import { adminDeptApi } from '@/api'
import type { AdminDept } from '@/api/admin/types'
import {
  collectExpandable,
  DepartmentTreeNavigator,
  findDeptPath,
  searchTree,
  SelectionFooter,
  toggleExpanded,
} from '@/components/management'
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

function deptNameMatches(node: AdminDept, keyword: string): boolean {
  return node.name.toLowerCase().includes(keyword)
}

export default function UserDepartmentsPage() {
  const guard = useRequireAuth({ moduleId: 'system-user' })
  const { params } = useRouter()
  const readonly = params.mode === 'readonly'

  const readDraft = useSelectionDraft((state) => state.readDraft)
  const writeDraft = useSelectionDraft((state) => state.writeDraft)

  const [tree, setTree] = useState<AdminDept[] | null>(null)
  const [error, setError] = useState<string | undefined>()
  const [loaded, setLoaded] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => new Set())

  // 草稿优先于 ?ids=：草稿来自本次编辑会话，URL 只用于无草稿时的深链进入
  const initial = useMemo(() => {
    const drafted = readDraft(DRAFT_KEYS.userDepts)
    return drafted.length ? drafted : parseIds(params.ids)
  }, [])

  const [selected, setSelected] = useState<number[]>(initial)

  // 抽成可调用函数：StateView 的「重试」不会让 useDidShow 再次触发，
  // 重试必须由页面自己重新发起请求，否则会永久卡在错误态。
  const load = () => {
    setError(undefined)
    adminDeptApi
      .getAdminDeptTree()
      .then((result) => {
        const next = result ?? []
        setTree(next)
        // 默认展开全部分支，children 里的最子级才会直接出现在列表里
        setExpandedIds(collectExpandable(next))
      })
      .catch((err) => setError(err instanceof Error ? err.message : '加载失败'))
  }

  useDidShow(() => {
    if (loaded) return
    setLoaded(true)
    load()
  })

  const trimmed = keyword.trim()
  const visible = useMemo(
    () => (trimmed ? searchTree(tree, deptNameMatches, trimmed) : (tree ?? [])),
    [tree, trimmed],
  )
  // 搜索时强制展开命中链，否则最子级仍然藏在折叠态里。
  // 不写回 expandedIds，避免搜索期间点箭头污染用户自己的展开态。
  const expandedNow = trimmed ? collectExpandable(visible) : expandedIds

  const selectedItems = useMemo(
    () =>
      [...selected]
        .map((id) => {
          const found = findDeptPath(tree, id)
          if (!found.length) return null
          return { id, label: found[found.length - 1].name, path: found.map((p) => p.name) }
        })
        .filter((item): item is { id: number; label: string; path: string[] } => item !== null),
    [selected, tree],
  )

  const handleConfirm = () => {
    // 只读浏览不得写草稿，否则会污染正在编辑的会话
    if (!readonly) writeDraft(DRAFT_KEYS.userDepts, selected)
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
      <View className={styles.header}>
        <Text className={styles.title}>选择部门</Text>
      </View>

      <View className={styles.search}>
        <Input
          className={styles.searchInput}
          value={keyword}
          placeholder="搜索部门名称"
          onInput={(event) => setKeyword(event.detail.value)}
        />
      </View>

      <StateView
        kind={error ? 'error' : loaded && !tree ? 'loading' : 'ready'}
        text={error}
        onRetry={load}
      >
        {trimmed && visible.length === 0 ? (
          <Text className={styles.empty}>没有匹配的部门</Text>
        ) : (
          <DepartmentTreeNavigator
            nodes={visible}
            expandedIds={expandedNow}
            selectedIds={new Set(selected)}
            readonly={readonly}
            onToggleExpand={(id) => {
              if (trimmed) return
              setExpandedIds((prev) => toggleExpanded(prev, id))
            }}
            onToggle={(id) =>
              setSelected((prev) =>
                prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
              )
            }
          />
        )}
      </StateView>

      <SelectionFooter
        count={selected.length}
        unit="个部门"
        items={selectedItems}
        readonly={readonly}
        onCancel={() => navigateBack()}
        onConfirm={handleConfirm}
        onRemoveItem={(id) => setSelected((prev) => prev.filter((x) => x !== id))}
      />
    </View>
  )
}