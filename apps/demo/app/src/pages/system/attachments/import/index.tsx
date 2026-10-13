import Taro, { useRouter } from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import { importImages } from '@/api/admin/attachments'
import { getSessionVersion } from '@/api/client'
import {
  FormContent,
  FormError,
  FormField,
  FormSection,
  FormSubmitBar,
  ManagementPage,
  ManagementPageHeader,
  TextAreaField,
} from '@/components/management'
import { useCanWrite } from '@/hooks'
import { canWriteModuleNow, useRequireAuth } from '@/utils/auth-guard'
import { navigateBack } from '@/utils/router'
import { errorMessage, withAccountScope } from '@/utils/account-scope'
import { parseImportLinks } from '../model'

const MODULE = 'system-attachments'
const CREATE = 'system:attachment:create'

/** 路由里的 folderId 只有是正整数时才视为指定了分组，否则导入到未分组 */
function routeFolderId(value: string | undefined) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : undefined
}

function AttachmentImportPage() {
  const guard = useRequireAuth({ moduleId: MODULE })
  const folderId = routeFolderId(useRouter().params.folderId)
  const canSave = useCanWrite(CREATE)
  const [links, setLinks] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [busy, setBusy] = useState(false)
  const locked = useRef(false)
  const mounted = useRef(true)
  const session = useRef(getSessionVersion()).current
  const active = () => mounted.current && session === getSessionVersion()
  // 请求返回后会话或权限已变（切换账号、权限被收回）时不回写、不提示、不跳转
  const writable = () => active() && canWriteModuleNow(MODULE, [CREATE])

  useEffect(() => {
    mounted.current = true
    if (process.env.TARO_ENV !== 'h5') void Taro.setNavigationBarTitle({ title: '链接导入' })
    return () => {
      mounted.current = false
    }
  }, [])

  async function submit() {
    if (!canSave || busy || locked.current || !writable()) return
    let urls: string[]
    try {
      urls = parseImportLinks(links)
    } catch (cause) {
      setSubmitError(errorMessage(cause))
      return
    }
    locked.current = true
    setBusy(true)
    setSubmitError('')
    try {
      await importImages(urls, folderId)
      if (writable()) {
        void Taro.showToast({ title: '导入成功', icon: 'success' })
        navigateBack(1)
      }
    } catch (cause) {
      if (writable()) setSubmitError(errorMessage(cause))
    } finally {
      locked.current = false
      if (active()) setBusy(false)
    }
  }

  if (!guard.ready || !guard.allowed) return <ManagementPage>{null}</ManagementPage>
  return (
    <ManagementPage>
      {process.env.TARO_ENV === 'h5' ? <ManagementPageHeader title="链接导入" /> : null}
      <FormContent>
        <FormSection title="导入链接">
          <FormField label="图片链接" stacked>
            <TextAreaField
              value={links}
              onChange={setLinks}
              placeholder="每行一个 HTTP/HTTPS 图片链接，最多 20 个"
              maxlength={-1}
              disabled={!canSave || busy}
            />
          </FormField>
        </FormSection>
        <FormError>{submitError}</FormError>
      </FormContent>
      {canSave ? <FormSubmitBar text="导入" submitting={busy} onSubmit={() => void submit()} /> : null}
    </ManagementPage>
  )
}

export default withAccountScope(AttachmentImportPage)
