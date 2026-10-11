import { useMemo, useState } from 'react'
import { Input, Text, View } from '@tarojs/components'
import { useDidShow, useRouter } from '@tarojs/taro'

import { adminDeptApi } from '@/api'
import type { AdminDept } from '@/api/admin/types'
import {
  childOf,
  DepartmentTreeNavigator,
  findDeptPath,
  searchDepts,
  SelectionFooter,
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

export default function UserDepartmentsPage() {
  const guard = useRequireAuth({ moduleId: 'system-user' })
  const { params } = useRouter()
  const readonly = params.mode === 'readonly'

  const readDraft = useSelectionDraft((state) => state.readDraft)
  const writeDraft = useSelectionDraft((state) => state.writeDraft)

  const [tree, setTree] = useState<AdminDept[] | null>(null)
  const [error, setError] = useState<string | undefined>()
  const [loaded, setLoaded] = useState(false)
  const [path, setPath] = useState<ReturnType<typeof findDeptPath>>([])
  const [keyword, setKeyword] = useState('')
  const [highlightId, setHighlightId] = useState<number | null>(null)

  // 草稿优先于 ?ids=：草稿来自本次编辑会话，URL 只用于无草稿时的深链进入
  const initial = useMemo(() => {
    const drafted = readDraft(DRAFT_KEYS.userDepts)
    return drafted.length ? drafted : parseIds(params.ids)
  }, [])

  const [selected, setSelected] = useState<number[]>(initial)

  useDidShow(() => {
    if (loaded) return
    setLoaded(true)
    adminDeptApi
      .getAdminDeptTree()
      .then((result) => setTree(result ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : '加载失败'))
  })

  const currentId = path.length ? path[path.length - 1].id : null
  const nodes = useMemo(() => childOf(tree, currentId), [tree, currentId])
  const hits = useMemo(() => (keyword.trim() ? searchDepts(tree, keyword) : null), [tree, keyword])

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
        onRetry={() => setLoaded(false)}
      >
        {hits ? (
          <View className={styles.results}>
            {hits.length === 0 ? (
              <Text className={styles.empty}>没有匹配的部门</Text>
            ) : (
              hits.map((hit) => (
                <View
                  key={hit.node.id}
                  className={styles.resultRow}
                  aria-label={`搜索结果-${hit.node.name}`}
                  onClick={() => {
                    setPath(hit.path)
                    setHighlightId(hit.node.id)
                    setKeyword('')
                  }}
                >
                  <Text className={styles.resultPath}>{hit.path.map((p) => p.name).join(' / ')}</Text>
                  <Text className={styles.resultName}>{hit.node.name}</Text>
                </View>
              ))
            )}
          </View>
        ) : (
          <DepartmentTreeNavigator
            nodes={nodes}
            path={path}
            selectedIds={new Set(selected)}
            highlightId={highlightId}
            readonly={readonly}
            onEnter={(node) => setPath([...path, { id: node.id, name: node.name }])}
            onToggle={(id) =>
              setSelected((prev) =>
                prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
              )
            }
            onCrumb={(index) => setPath(path.slice(0, index + 1))}
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