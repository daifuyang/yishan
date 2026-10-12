import { useDidShow } from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import { type AttachmentFolder, getFolderTree } from '@/api/admin/attachments'
import { Tag } from '@/components/atoms'
import {
  ManagementHeaderAction,
  ManagementList,
  ManagementPage,
  ManagementPageHeader,
  ManagementStates,
  ManagementTreeCell,
} from '@/components/management'
import { SYSTEM_PAGES } from '@/constants/routes'
import { useCanWrite } from '@/hooks'
import { useCurrentModuleAccess, useRequireAuth } from '@/utils/auth-guard'
import { navigateTo } from '@/utils/router'
import { errorMessage, withAccountScope } from '../../_shared/AdminUI'
import { KIND_LABELS } from '../model'

const MODULE = 'system-attachments'
const CREATE = 'system:attachment:create'

function FoldersPage() {
  const guard = useRequireAuth({ moduleId: MODULE })
  const isCurrent = useCurrentModuleAccess(MODULE)
  const canCreate = useCanWrite(CREATE)
  const [folders, setFolders] = useState<AttachmentFolder[]>([])
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // 首次挂载的 effect 与 useDidShow 可能并发请求：只认最后一次的结果
  const sequence = useRef(0)

  async function load() {
    if (!guard.ready || !guard.allowed) return
    const ticket = ++sequence.current
    // 返回时会话已切换、模块访问被收回或已有更新的请求时，不回写旧结果
    const live = () => ticket === sequence.current && isCurrent()
    setLoading(true)
    setError('')
    try {
      const tree = await getFolderTree()
      if (live()) setFolders(tree)
    } catch (cause) {
      if (live()) setError(errorMessage(cause))
    } finally {
      if (live()) setLoading(false)
    }
  }
  useEffect(() => {
    void load()
  }, [guard.ready, guard.allowed])
  useDidShow(() => {
    void load()
  })

  if (!guard.ready || !guard.allowed) return <ManagementPage>{null}</ManagementPage>

  const rows: { folder: AttachmentFolder; depth: number }[] = []
  const walk = (nodes: AttachmentFolder[], depth: number) => {
    for (const folder of nodes) {
      rows.push({ folder, depth })
      if (expanded.has(folder.id)) walk(folder.children || [], depth + 1)
    }
  }
  walk(folders, 0)
  const toggle = (id: number) =>
    setExpanded((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <ManagementPage>
      <ManagementPageHeader
        title="分组管理"
        action={
          canCreate ? (
            <ManagementHeaderAction
              label="新建"
              onClick={() => navigateTo(`/${SYSTEM_PAGES.attachmentFolderForm}`)}
            />
          ) : undefined
        }
      />
      <ManagementStates
        kind={
          error
            ? 'error'
            : loading && !folders.length
              ? 'loading'
              : !folders.length
                ? 'empty'
                : 'ready'
        }
        errorText={error || undefined}
        emptyText="暂无分组"
        onRetry={() => void load()}
      >
        <ManagementList>
          {rows.map(({ folder, depth }, index) => (
            // 点行进编辑、点箭头折叠：ManagementTreeCell 的箭头 stopPropagation，两者互不触发
            <ManagementTreeCell
              key={folder.id}
              glyph="folder"
              title={folder.name}
              description={folder.kind === 'all' ? undefined : `仅${KIND_LABELS[folder.kind]}`}
              tag={
                folder.status === '0' ? (
                  <Tag size="sm" variant="default">
                    禁用
                  </Tag>
                ) : undefined
              }
              depth={depth}
              hasChildren={Boolean(folder.children?.length)}
              expanded={expanded.has(folder.id)}
              onToggle={() => toggle(folder.id)}
              bordered={index < rows.length - 1}
              onClick={() => navigateTo(`/${SYSTEM_PAGES.attachmentFolderForm}?id=${folder.id}`)}
            />
          ))}
        </ManagementList>
      </ManagementStates>
    </ManagementPage>
  )
}

export default withAccountScope(FoldersPage)
