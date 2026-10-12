import Taro, { useRouter } from '@tarojs/taro'
import { Text } from '@tarojs/components'
import { useEffect, useRef, useState } from 'react'
import { type AttachmentFolder, getAttachment, getFolderTree, updateAttachment } from '@/api/admin/attachments'
import { getSessionVersion } from '@/api/client'
import { StateView } from '@/components/feedback'
import {
  EnumField,
  FormContent,
  FormError,
  FormField,
  FormSection,
  FormSubmitBar,
  ManagementPage,
  TextField,
} from '@/components/management'
import { PageHeader } from '@/components/molecules'
import { useCanWrite } from '@/hooks'
import { canWriteModuleNow, useRequireAuth } from '@/utils/auth-guard'
import { navigateBack } from '@/utils/router'
import { errorMessage, withAccountScope } from '../../_shared/AdminUI'
import { FolderTreeSheet } from '../FolderTreeSheet'
import { attachmentEditPayload, folderLabel, STATUS_ENUM } from '../model'
import styles from './index.module.scss'

const MODULE = 'system-attachments'
const LIST = 'system:attachment:list'
const UPDATE = 'system:attachment:update'

function AttachmentFormPage() {
  const guard = useRequireAuth({ moduleId: MODULE })
  const id = Number(useRouter().params.id)
  const canSave = useCanWrite(UPDATE)
  const [name, setName] = useState('')
  const [folderId, setFolderId] = useState(0)
  const [status, setStatus] = useState<'0' | '1'>('1')
  const [folders, setFolders] = useState<AttachmentFolder[]>([])
  const [picking, setPicking] = useState(false)
  // 分组树拉取失败：原分组既显示不出也无法重选，锁住分组行；保存照常提交原 folderId
  const [folderFailed, setFolderFailed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [retry, setRetry] = useState(0)
  const [busy, setBusy] = useState(false)
  const locked = useRef(false)
  const mounted = useRef(true)
  const session = useRef(getSessionVersion()).current
  const active = () => mounted.current && session === getSessionVersion()

  useEffect(() => {
    if (process.env.TARO_ENV !== 'h5') void Taro.setNavigationBarTitle({ title: '编辑素材' })
  }, [])
  useEffect(() => {
    mounted.current = true
    let current = true
    // 加载返回后会话或权限已变（切换账号、权限被收回）时不回填旧数据
    const live = () => current && active() && canWriteModuleNow(MODULE, [LIST])
    if (guard.ready && guard.allowed) {
      setLoading(true)
      setError('')
      void (async () => {
        try {
          if (!Number.isInteger(id) || id <= 0) throw new Error('素材 ID 缺失或无效')
          // 分组树拿不到时不阻塞编辑名称和状态，只把分组行标成加载失败
          const [item, tree] = await Promise.all([
            getAttachment(id),
            getFolderTree().catch(() => null),
          ])
          if (!live()) return
          setName(item.name || item.originalName)
          setFolderId(item.folderId || 0)
          setStatus(item.status)
          setFolders(tree ?? [])
          setFolderFailed(tree === null)
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

  const disabled = !canSave || busy || loading
  const openPicker = () => {
    if (!disabled && !folderFailed) setPicking(true)
  }
  async function save() {
    if (disabled || locked.current || !active() || !canWriteModuleNow(MODULE, [UPDATE])) return
    let payload: ReturnType<typeof attachmentEditPayload>
    try {
      // 只提交 name / folderId / status：带上 metadata 会清掉素材的扩展信息
      payload = attachmentEditPayload(name, folderId, status)
    } catch (cause) {
      setSubmitError(errorMessage(cause))
      return
    }
    locked.current = true
    setBusy(true)
    setSubmitError('')
    try {
      await updateAttachment(id, payload)
      if (active() && canWriteModuleNow(MODULE, [UPDATE])) {
        void Taro.showToast({ title: '保存成功', icon: 'success' })
        navigateBack(1)
      }
    } catch (cause) {
      if (active() && canWriteModuleNow(MODULE, [UPDATE])) setSubmitError(errorMessage(cause))
    } finally {
      locked.current = false
      if (active()) setBusy(false)
    }
  }

  if (!guard.ready || !guard.allowed) return <ManagementPage>{null}</ManagementPage>
  return (
    <ManagementPage>
      {process.env.TARO_ENV === 'h5' ? <PageHeader title="编辑素材" /> : null}
      <StateView
        kind={error ? 'error' : loading ? 'loading' : 'ready'}
        text={error || undefined}
        onRetry={() => setRetry((value) => value + 1)}
      >
        <FormContent>
          <FormSection title="基础信息">
            <FormField label="名称" required disabled={disabled}>
              <TextField
                value={name}
                onChange={setName}
                placeholder="请输入素材名称"
                maxlength={255}
                disabled={disabled}
              />
            </FormField>
            {/* 取值与箭头都能打开选择面板：取值撑满控件列，整行右侧可点 */}
            <FormField
              label="分组"
              arrow={!disabled && !folderFailed}
              disabled={disabled}
              onArrowClick={openPicker}
            >
              <Text className={styles.value} onClick={openPicker}>
                {folderFailed ? '分组加载失败' : folderLabel(folders, folderId, '未分组')}
              </Text>
            </FormField>
            <EnumField
              label="状态"
              value={status}
              options={STATUS_ENUM}
              onChange={setStatus}
              disabled={disabled}
            />
          </FormSection>
          <FormError>{submitError}</FormError>
        </FormContent>
        {canSave ? <FormSubmitBar text="保存" submitting={busy} onSubmit={() => void save()} /> : null}
      </StateView>
      <FolderTreeSheet
        open={picking}
        title="选择分组"
        folders={folders}
        value={folderId}
        rootLabel="未分组"
        onSelect={setFolderId}
        onClose={() => setPicking(false)}
      />
    </ManagementPage>
  )
}

export default withAccountScope(AttachmentFormPage)
