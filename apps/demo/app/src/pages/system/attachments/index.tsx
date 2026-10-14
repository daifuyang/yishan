import Taro, { useDidHide, useDidShow } from '@tarojs/taro'
import { View } from '@tarojs/components'
import { useEffect, useRef, useState } from 'react'
import {
  type Attachment,
  type AttachmentFolder,
  attachmentUrl,
  batchDeleteAttachments,
  type CloudUploadConfig,
  getCloudUploadConfig,
  getFolderTree,
  listAttachments,
  type UploadFile,
  uploadAttachment,
} from '@/api/admin/attachments'
import { getSessionVersion } from '@/api/client'
import { Tag } from '@/components/atoms'
import {
  ActionSheet,
  type ActionSheetItem,
  BottomSelectSheet,
  Checkbox,
  ManagementCell,
  ManagementFilterBar,
  ManagementFilterClear,
  ManagementFilterTriggers,
  ManagementHeaderAction,
  ManagementList,
  ManagementListFooter,
  ManagementPage,
  ManagementPageHeader,
  ManagementSearchBar,
  ManagementStates,
  SelectionFooter,
} from '@/components/management'
import { SYSTEM_PAGES } from '@/constants/routes'
import { confirmAction, useCanWrite, useListPagination } from '@/hooks'
import { useCurrentModuleAccess, useRequireAuth } from '@/utils/auth-guard'
import { isPickerCancel } from '@/utils/picker'
import { navigateTo } from '@/utils/router'
import { errorMessage, withAccountScope } from '@/utils/account-scope'
import { chooseFiles } from './chooseFiles'
import { FolderTreeSheet } from './FolderTreeSheet'
import styles from './index.module.scss'
import {
  buildAttachmentQuery,
  DEFAULT_ATTACHMENT_FILTERS,
  folderLabel,
  formatSize,
  KIND_GLYPH,
  KIND_OPTIONS,
  kindOfFile,
  readAttachmentFilters,
  STATUS_OPTIONS,
} from './model'

const CREATE = 'system:attachment:create'
const DELETE = 'system:attachment:delete'
const CLOUD = [CREATE, 'system:option:list', 'system:storage:upload-token']

function AttachmentsPage() {
  const guard = useRequireAuth({ moduleId: 'system-attachments' })
  const isCurrent = useCurrentModuleAccess('system-attachments')
  const canCreate = useCanWrite(CREATE)
  const canDelete = useCanWrite(DELETE)
  const canCloud = useCanWrite(...CLOUD)
  const canReadOptions = useCanWrite('system:option:list')
  const [panel, setPanel] = useState<string | null>(null)
  const [uploadSheet, setUploadSheet] = useState<'local' | 'cloud' | null>(null)
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<number[]>([])
  const [folders, setFolders] = useState<AttachmentFolder[]>([])
  const [cloud, setCloud] = useState<CloudUploadConfig | undefined>()
  const [busy, setBusy] = useState(false)
  const locked = useRef(false)
  const list = useListPagination<Attachment>({
    enabled: guard.ready && guard.allowed,
    initialFilters: { ...DEFAULT_ATTACHMENT_FILTERS },
    fetcher: async ({ page, pageSize, keyword, filters }) => {
      const result = await listAttachments(
        buildAttachmentQuery(page, pageSize, keyword, readAttachmentFilters(filters)),
      )
      return { list: result.data, total: result.pagination.total }
    },
  })
  const filters = readAttachmentFilters(list.filters)

  // 筛选变化后看不到的素材不能还挂在已选里，否则会被一起删掉
  useEffect(() => {
    setSelected([])
  }, [list.keyword, list.filters])
  // 刷新回到第 1 页后，后续页的已选素材看不到了，同样要剔除；无变化时返回原数组，不触发重渲染
  useEffect(() => {
    const visible = new Set(list.list.map((item) => item.id))
    setSelected((previous) =>
      previous.every((id) => visible.has(id))
        ? previous
        : previous.filter((id) => visible.has(id)),
    )
  }, [list.list])

  const loadFolders = () => {
    getFolderTree()
      .then((data) => setFolders(data))
      .catch(() => {
        // 分组树只用于筛选与显示名称，失败时保留「全部分组」
      })
  }
  useEffect(() => {
    if (!guard.ready || !guard.allowed) return
    loadFolders()
    if (!canReadOptions) return
    getCloudUploadConfig()
      .then(setCloud)
      .catch(() => setCloud(undefined))
  }, [guard.ready, guard.allowed, canReadOptions])
  useDidShow(() => {
    if (!guard.ready || !guard.allowed) return
    loadFolders()
    void list.refresh()
  })
  useDidHide(() => {
    setPanel(null)
    setUploadSheet(null)
  })

  const changeFilters = (patch: Record<string, unknown>) => {
    list.setFilters(patch)
    void Taro.pageScrollTo({ scrollTop: 0, duration: 0 })
  }
  const clearFilters = () => {
    list.setKeyword('')
    changeFilters({ ...DEFAULT_ATTACHMENT_FILTERS })
  }

  /** session 在打开选择器前取得：选择期间切换账号，选完也不能开始上传 */
  async function upload(files: UploadFile[], useCloud: boolean, session: number) {
    const required = useCloud ? CLOUD : [CREATE]
    const current = () => session === getSessionVersion() && isCurrent(required)
    if (!files.length || locked.current || !current()) return
    locked.current = true
    setBusy(true)
    let uploaded = 0
    try {
      for (const file of files) {
        if (!current()) return
        await uploadAttachment(
          file,
          { folderId: filters.folderId || undefined, kind: kindOfFile(file) },
          useCloud ? cloud : undefined,
        )
        if (!current()) return
        uploaded++
      }
      void Taro.showToast({ title: `已上传 ${uploaded} 个文件`, icon: 'success' })
      void list.refresh()
    } catch (reason) {
      if (!current()) return
      const done = uploaded ? `，已成功上传 ${uploaded} 个` : ''
      void Taro.showToast({ title: `${errorMessage(reason)}${done}`, icon: 'none' })
      if (uploaded) void list.refresh()
    } finally {
      locked.current = false
      setBusy(false)
    }
  }

  /** H5 的 chooseImage / chooseVideo 返回 blob URL，上传完要释放，否则一直占着内存 */
  const revokeBlobs = (files: UploadFile[]) => {
    if (process.env.TARO_ENV !== 'h5') return
    for (const file of files) if (file.path.startsWith('blob:')) URL.revokeObjectURL(file.path)
  }

  async function pickImages(useCloud: boolean) {
    const session = getSessionVersion()
    try {
      const result = await Taro.chooseImage({ count: 9 })
      const files = result.tempFiles.map((file) => ({
        path: file.path,
        name: file.originalFileObj?.name || file.path.split('/').pop() || 'image.jpg',
        size: file.size,
        mimeType: file.type || 'image/jpeg',
      }))
      try {
        await upload(files, useCloud, session)
      } finally {
        revokeBlobs(files)
      }
    } catch (reason) {
      if (session === getSessionVersion() && !isPickerCancel(reason))
        void Taro.showToast({ title: errorMessage(reason), icon: 'none' })
    }
  }
  async function pickVideo(useCloud: boolean) {
    const session = getSessionVersion()
    try {
      const result = await Taro.chooseVideo({ sourceType: ['album', 'camera'] })
      const files = [
        {
          path: result.tempFilePath,
          name: result.tempFilePath.split('/').pop() || 'video.mp4',
          size: result.size,
          mimeType: 'video/mp4',
        },
      ]
      try {
        await upload(files, useCloud, session)
      } finally {
        revokeBlobs(files)
      }
    } catch (reason) {
      if (session === getSessionVersion() && !isPickerCancel(reason))
        void Taro.showToast({ title: errorMessage(reason), icon: 'none' })
    }
  }
  function pickFiles(useCloud: boolean) {
    const session = getSessionVersion()
    // H5 下 chooseFiles 内部同步 click()，这里不能先 await 别的东西
    chooseFiles()
      .then(async (files) => {
        try {
          await upload(files, useCloud, session)
        } finally {
          if (process.env.TARO_ENV === 'h5')
            for (const file of files) URL.revokeObjectURL(file.path)
        }
      })
      .catch((reason) => {
        if (session === getSessionVersion())
          void Taro.showToast({ title: errorMessage(reason), icon: 'none' })
      })
  }

  const sourceItems = (useCloud: boolean): ActionSheetItem[] => [
    {
      key: 'image',
      label: '图片',
      icon: 'image',
      onClick: () => {
        setUploadSheet(null)
        void pickImages(useCloud)
      },
    },
    {
      key: 'video',
      label: '视频',
      icon: 'video',
      onClick: () => {
        setUploadSheet(null)
        void pickVideo(useCloud)
      },
    },
    {
      key: 'file',
      label: '文件',
      icon: 'file',
      onClick: () => {
        setUploadSheet(null)
        pickFiles(useCloud)
      },
    },
  ]
  const uploadItems: ActionSheetItem[] =
    uploadSheet === 'cloud'
      ? sourceItems(true)
      : [
          ...sourceItems(false),
          {
            key: 'import',
            label: '链接导入',
            icon: 'globe',
            onClick: () => {
              setUploadSheet(null)
              navigateTo(
                `/${SYSTEM_PAGES.attachmentImport}${filters.folderId ? `?folderId=${filters.folderId}` : ''}`,
              )
            },
          },
          ...(cloud?.provider === 'qiniu' && canCloud
            ? [
                {
                  key: 'cloud',
                  label: '上传到七牛云',
                  icon: 'cloud' as const,
                  onClick: () => setUploadSheet('cloud'),
                },
              ]
            : []),
        ]

  async function removeSelected() {
    if (!selected.length || locked.current || !isCurrent([DELETE])) return
    const session = getSessionVersion()
    const current = () => session === getSessionVersion() && isCurrent([DELETE])
    locked.current = true
    setBusy(true)
    try {
      const ok = await confirmAction({
        title: '删除素材',
        content: `确认删除已选择的 ${selected.length} 个素材？`,
      })
      if (!ok || !current()) return
      await batchDeleteAttachments(selected)
      if (!current()) return
      setSelected([])
      setSelecting(false)
      void Taro.showToast({ title: '已删除', icon: 'success' })
      void list.refresh()
    } catch (reason) {
      if (current()) void Taro.showToast({ title: errorMessage(reason), icon: 'none' })
    } finally {
      locked.current = false
      setBusy(false)
    }
  }

  if (!guard.ready || !guard.allowed) return <ManagementPage>{null}</ManagementPage>

  const filtered = Boolean(list.keyword || filters.folderId || filters.kind || filters.status)
  const kind = list.error
    ? 'error'
    : list.loading && !list.list.length
      ? 'loading'
      : !list.list.length
        ? 'empty'
        : 'ready'
  const kindLabel = KIND_OPTIONS.find((option) => option.key === filters.kind)?.label ?? '全部类型'
  const statusLabel =
    STATUS_OPTIONS.find((option) => option.key === filters.status)?.label ?? '全部状态'
  const toggle = (id: number) =>
    setSelected((previous) =>
      previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id],
    )

  return (
    <ManagementPage
      bottomActions={process.env.TARO_ENV === 'h5' && !selecting && (canDelete || canCreate) ? (
        <View className={styles.headerActions}>
          {canDelete ? <ManagementHeaderAction label="管理" showIcon={false} onClick={() => setSelecting(true)} /> : null}
          {canCreate ? <ManagementHeaderAction label="上传" onClick={() => setUploadSheet('local')} /> : null}
        </View>
      ) : undefined}
    >
      <ManagementPageHeader
        title="媒体库"
        action={
          selecting ? (
            <ManagementHeaderAction
              label="完成"
              onClick={() => {
                setSelecting(false)
                setSelected([])
              }}
            />
          ) : (
            <View className={styles.headerActions}>
              {canDelete ? (
                <ManagementHeaderAction label="管理" onClick={() => setSelecting(true)} />
              ) : null}
              {canCreate ? (
                <ManagementHeaderAction label="上传" onClick={() => setUploadSheet('local')} />
              ) : null}
            </View>
          )
        }
      />
      <ManagementFilterBar>
        <ManagementSearchBar
          value={list.keyword}
          onChange={list.setKeyword}
          placeholder="搜索素材名称"
        />
        <ManagementFilterTriggers
          panel={panel}
          onPanelChange={(key) => setPanel(panel === key ? null : key)}
          triggers={[
            {
              key: 'folder',
              label: folderLabel(folders, filters.folderId, '全部分组'),
              active: Boolean(filters.folderId),
            },
            { key: 'kind', label: kindLabel, active: Boolean(filters.kind) },
            { key: 'status', label: statusLabel, active: Boolean(filters.status) },
          ]}
        />
      </ManagementFilterBar>
      <FolderTreeSheet
        open={panel === 'folder'}
        title="选择分组"
        folders={folders}
        value={filters.folderId}
        rootLabel="全部分组"
        footer={{
          label: '管理分组',
          onClick: () => navigateTo(`/${SYSTEM_PAGES.attachmentFolders}`),
        }}
        onSelect={(folderId) => changeFilters({ folderId })}
        onClose={() => setPanel(null)}
      />
      <BottomSelectSheet
        open={panel === 'kind' || panel === 'status'}
        title={panel === 'kind' ? '素材类型' : '素材状态'}
        options={panel === 'kind' ? KIND_OPTIONS : STATUS_OPTIONS}
        value={panel === 'kind' ? filters.kind : filters.status}
        onSelect={(key) => changeFilters(panel === 'kind' ? { kind: key } : { status: key })}
        onClose={() => setPanel(null)}
      />
      <ActionSheet
        open={uploadSheet !== null}
        title={
          uploadSheet === 'cloud'
            ? '上传到七牛云'
            : `上传到「${folderLabel(folders, filters.folderId, '未分组')}」`
        }
        items={uploadItems}
        onClose={() => setUploadSheet(null)}
      />
      {kind === 'empty' && filtered ? <ManagementFilterClear onClick={clearFilters} /> : null}
      <ManagementStates
        kind={kind}
        errorText={list.error || undefined}
        emptyText={filtered ? '未找到符合条件的素材' : '暂无素材'}
        onRetry={list.refresh}
      >
        <ManagementList>
          {list.list.map((item, index) => (
            // 多选时整行（含复选框与左侧留白）统一切换；Cell 不再挂 onClick，避免冒泡切换两次
            <View
              key={item.id}
              className={selecting ? styles.selectRow : undefined}
              aria-label={selecting ? `选择-${item.name || item.originalName}` : undefined}
              aria-checked={selecting ? selected.includes(item.id) : undefined}
              hoverClass={selecting ? styles.selectRowHover : undefined}
              onClick={selecting ? () => toggle(item.id) : undefined}
            >
              {selecting ? <Checkbox checked={selected.includes(item.id)} /> : null}
              <View className={styles.selectCell}>
                <ManagementCell
                  bordered={index < list.list.length - 1}
                  thumb={{
                    src:
                      item.kind === 'image'
                        ? attachmentUrl(item, cloud?.domain) || undefined
                        : undefined,
                    glyph: KIND_GLYPH[item.kind],
                  }}
                  title={item.name || item.originalName}
                  description={formatSize(item.size)}
                  tag={
                    item.status === '0' ? (
                      <Tag size="sm" variant="default">
                        禁用
                      </Tag>
                    ) : undefined
                  }
                  showArrow={!selecting}
                  onClick={
                    selecting
                      ? undefined
                      : () => navigateTo(`/${SYSTEM_PAGES.attachmentDetail}?id=${item.id}`)
                  }
                />
              </View>
            </View>
          ))}
        </ManagementList>
      </ManagementStates>
      {selecting ? <View className={styles.footerSpace} /> : null}
      {selecting ? (
        <SelectionFooter
          count={selected.length}
          unit="个素材"
          items={list.list
            .filter((item) => selected.includes(item.id))
            .map((item) => ({ id: item.id, label: item.name || item.originalName, path: [] }))}
          confirmLabel="删除"
          confirmDanger
          onRemoveItem={toggle}
          onCancel={() => {
            setSelecting(false)
            setSelected([])
          }}
          onConfirm={() => void (busy ? undefined : removeSelected())}
        />
      ) : (
        <ManagementListFooter
          loadingMore={list.loadingMore}
          refreshing={list.refreshing}
          finished={list.finished}
          empty={!list.list.length}
          summary={kind === 'ready' ? `共 ${list.total} 个素材` : undefined}
        />
      )}
    </ManagementPage>
  )
}

export default withAccountScope(AttachmentsPage)
