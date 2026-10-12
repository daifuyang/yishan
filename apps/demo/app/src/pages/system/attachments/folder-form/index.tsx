import { Text } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import {
  type AttachmentFolder,
  createFolder,
  deleteFolder,
  getFolder,
  getFolderTree,
  updateFolder,
} from '@/api/admin/attachments'
import { getSessionVersion } from '@/api/client'
import { StateView } from '@/components/feedback'
import {
  ActionSheet,
  EnumField,
  FormContent,
  FormError,
  FormField,
  FormSection,
  FormSubmitBar,
  ManagementHeaderAction,
  ManagementPage,
  ManagementPageHeader,
  TextAreaField,
  TextField,
} from '@/components/management'
import { confirmAction, useCanWrite } from '@/hooks'
import { canWriteModuleNow, useRequireAuth } from '@/utils/auth-guard'
import { navigateBack } from '@/utils/router'
import { errorMessage, withAccountScope } from '../../_shared/AdminUI'
import { FolderTreeSheet } from '../FolderTreeSheet'
import {
  FOLDER_KIND_OPTIONS,
  type FolderFormValues,
  folderLabel,
  folderPayload,
  STATUS_ENUM,
  subtreeIds,
} from '../model'
import styles from './index.module.scss'

const MODULE = 'system-attachments'
const CREATE = 'system:attachment:create'
const UPDATE = 'system:attachment:update'
const DELETE = 'system:attachment:delete'

function FolderFormPage() {
  const guard = useRequireAuth({ moduleId: MODULE })
  const params = useRouter().params
  const id = params.id ? Number(params.id) : undefined
  const required = id ? UPDATE : CREATE
  const canSave = useCanWrite(required)
  const canDelete = useCanWrite(DELETE)
  const [values, setValues] = useState<FolderFormValues>({
    name: '',
    // 从某分组下新建时，上级默认取路由带来的 parentId
    parentId: Number(params.parentId) || 0,
    kind: 'all',
    status: '1',
    sort: '0',
    remark: '',
  })
  const [folders, setFolders] = useState<AttachmentFolder[]>([])
  const [picking, setPicking] = useState(false)
  // 分组树拉取失败：原上级既显示不出也无法重选，锁住上级行；保存照常提交原 parentId
  const [folderFailed, setFolderFailed] = useState(false)
  const [more, setMore] = useState(false)
  const [loading, setLoading] = useState(Boolean(id))
  const [error, setError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [retry, setRetry] = useState(0)
  const [busy, setBusy] = useState(false)
  const locked = useRef(false)
  const mounted = useRef(true)
  const session = useRef(getSessionVersion()).current
  const active = () => mounted.current && session === getSessionVersion()
  const title = id ? '编辑分组' : '新建分组'

  useEffect(() => {
    if (process.env.TARO_ENV !== 'h5') void Taro.setNavigationBarTitle({ title })
  }, [title])
  useEffect(() => {
    mounted.current = true
    let current = true
    // 加载返回后会话或模块访问已变（切换账号、权限被收回）时不回填旧数据
    const live = () => current && active() && canWriteModuleNow(MODULE, [])
    if (guard.ready && guard.allowed) {
      setLoading(Boolean(id))
      setError('')
      void (async () => {
        try {
          if (id !== undefined && (!Number.isInteger(id) || id <= 0))
            throw new Error('分组 ID 缺失或无效')
          // 分组树只用于上级显示与选择，拿不到时不阻塞编辑，只把上级行标成加载失败
          const [tree, folder] = await Promise.all([
            getFolderTree().catch(() => null),
            id ? getFolder(id) : Promise.resolve(null),
          ])
          if (!live()) return
          setFolders(tree ?? [])
          setFolderFailed(tree === null)
          if (folder)
            setValues({
              name: folder.name,
              parentId: folder.parentId || 0,
              kind: folder.kind,
              status: folder.status,
              sort: String(folder.sort_order ?? 0),
              remark: folder.remark || '',
            })
        } catch (cause) {
          if (live()) setError(errorMessage(cause))
        } finally {
          if (live()) setLoading(false)
        }
      })()
    }
    return () => {
      current = false
      mounted.current = false
    }
  }, [id, retry, guard.ready, guard.allowed, session])

  const patch = (next: Partial<FolderFormValues>) =>
    setValues((previous) => ({ ...previous, ...next }))
  const disabled = !canSave || busy || loading
  const openPicker = () => {
    if (!disabled && !folderFailed) setPicking(true)
  }

  async function save() {
    if (disabled || locked.current || !active() || !canWriteModuleNow(MODULE, [required])) return
    let payload: ReturnType<typeof folderPayload>
    try {
      payload = folderPayload(values)
    } catch (cause) {
      setSubmitError(errorMessage(cause))
      return
    }
    locked.current = true
    setBusy(true)
    setSubmitError('')
    try {
      if (id) await updateFolder(id, payload)
      else await createFolder(payload)
      if (active() && canWriteModuleNow(MODULE, [required])) {
        void Taro.showToast({ title: '保存成功', icon: 'success' })
        navigateBack(1)
      }
    } catch (cause) {
      if (active() && canWriteModuleNow(MODULE, [required])) setSubmitError(errorMessage(cause))
    } finally {
      locked.current = false
      if (active()) setBusy(false)
    }
  }

  async function remove() {
    setMore(false)
    const allowed = () => active() && canWriteModuleNow(MODULE, [DELETE])
    if (!id || locked.current || !allowed()) return
    locked.current = true
    setBusy(true)
    try {
      const ok = await confirmAction({
        title: '删除分组',
        content: `确认删除「${values.name}」？包含子分组或素材的分组不能删除。`,
      })
      if (!ok || !allowed()) return
      await deleteFolder(id)
      if (!allowed()) return
      void Taro.showToast({ title: '已删除', icon: 'success' })
      navigateBack(1)
    } catch (cause) {
      if (allowed()) setSubmitError(errorMessage(cause))
    } finally {
      locked.current = false
      if (active()) setBusy(false)
    }
  }

  if (!guard.ready || !guard.allowed) return <ManagementPage>{null}</ManagementPage>
  return (
    <ManagementPage>
      <ManagementPageHeader
        title={title}
        action={
          id && canDelete ? (
            <ManagementHeaderAction label="更多" onClick={() => setMore(true)} />
          ) : undefined
        }
      />
      <StateView
        kind={error ? 'error' : loading ? 'loading' : 'ready'}
        text={error || undefined}
        onRetry={() => setRetry((value) => value + 1)}
      >
        <FormContent>
          <FormSection title="基础信息">
            <FormField label="名称" required disabled={disabled}>
              <TextField
                value={values.name}
                onChange={(name) => patch({ name })}
                placeholder="请输入分组名称"
                maxlength={100}
                disabled={disabled}
              />
            </FormField>
            {/* 取值与箭头都能打开选择面板：取值撑满控件列，整行右侧可点 */}
            <FormField
              label="上级分组"
              arrow={!disabled && !folderFailed}
              disabled={disabled}
              onArrowClick={openPicker}
            >
              <Text className={styles.value} onClick={openPicker}>
                {folderFailed ? '分组加载失败' : folderLabel(folders, values.parentId, '顶级分组')}
              </Text>
            </FormField>
            <EnumField
              label="素材类型"
              value={values.kind}
              options={FOLDER_KIND_OPTIONS}
              onChange={(kind) => patch({ kind })}
              disabled={disabled}
            />
            <EnumField
              label="状态"
              value={values.status}
              options={STATUS_ENUM}
              onChange={(status) => patch({ status })}
              disabled={disabled}
            />
            <FormField label="排序" disabled={disabled}>
              <TextField
                value={values.sort}
                onChange={(sort) => patch({ sort })}
                placeholder="非负整数，越小越靠前"
                disabled={disabled}
              />
            </FormField>
            <FormField label="备注" stacked disabled={disabled}>
              <TextAreaField
                value={values.remark}
                onChange={(remark) => patch({ remark })}
                placeholder="请输入备注"
                maxlength={255}
                disabled={disabled}
              />
            </FormField>
          </FormSection>
          <FormError>{submitError}</FormError>
        </FormContent>
        {canSave ? (
          <FormSubmitBar text="保存" submitting={busy} onSubmit={() => void save()} />
        ) : null}
      </StateView>
      <FolderTreeSheet
        open={picking}
        title="选择上级分组"
        folders={folders}
        value={values.parentId}
        rootLabel="顶级分组"
        // 上级不能选自身或后代，否则形成环
        excludeIds={id ? subtreeIds(folders, id) : undefined}
        onSelect={(parentId) => patch({ parentId })}
        onClose={() => setPicking(false)}
      />
      <ActionSheet
        open={more}
        items={[
          {
            key: 'delete',
            label: '删除分组',
            icon: 'trash',
            danger: true,
            onClick: () => void remove(),
          },
        ]}
        onClose={() => setMore(false)}
      />
    </ManagementPage>
  )
}

export default withAccountScope(FolderFormPage)
