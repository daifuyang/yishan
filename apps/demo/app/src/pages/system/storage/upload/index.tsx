import { StateView } from '@/components/feedback'
import {
  FormContent,
  FormError,
  FormField,
  FormSection,
  FormSubmitBar,
  ManagementPage,
  TextField,
} from '@/components/management'
import { PageHeader } from '@/components/molecules'
import { withAccountScope } from '../../_shared/AdminUI'
import { QINIU_DEFAULTS, sectionOf } from '../model'
import { useStorageConfig } from '../useStorageConfig'

const section = sectionOf('upload')

/** 七牛上传参数，只在服务商为七牛云时出现。有效期清空表示使用默认值。 */
function StorageUploadPage() {
  const storage = useStorageConfig()
  const { guard, config, update, disabled } = storage
  if (!guard.ready || !guard.allowed) return <ManagementPage>{null}</ManagementPage>
  const setQiniu = (patch: Partial<typeof config.qiniu>) =>
    update((previous) => ({ ...previous, qiniu: { ...previous.qiniu, ...patch } }))
  const expires = config.qiniu.tokenExpires
  return (
    <ManagementPage>
      {process.env.TARO_ENV === 'h5' ? <PageHeader title={section.title} /> : null}
      <StateView
        kind={storage.error && !storage.loaded ? 'error' : storage.loading && !storage.loaded ? 'loading' : 'ready'}
        text={storage.error || undefined}
        onRetry={storage.retry}
      >
        <FormContent>
          <FormSection title="上传凭证" hint="客户端直传七牛云时使用的上传凭证，有效期 60–86400 秒">
            <FormField label="有效期(秒)" disabled={disabled}>
              <TextField
                value={expires === undefined || Number.isNaN(expires) ? '' : String(expires)}
                onChange={(text) => setQiniu({ tokenExpires: text.trim() ? Number(text) : undefined })}
                placeholder={`默认 ${QINIU_DEFAULTS.tokenExpires}`}
                maxlength={5}
                disabled={disabled}
              />
            </FormField>
          </FormSection>
          <FormSection title="上传地址">
            <FormField label="上传域名" disabled={disabled}>
              <TextField value={config.qiniu.uploadHost || ''} onChange={(uploadHost) => setQiniu({ uploadHost })} placeholder="如 https://up-z0.qiniup.com，可选" maxlength={255} disabled={disabled} />
            </FormField>
            <FormField label="回调地址" disabled={disabled}>
              <TextField value={config.qiniu.callbackUrl || ''} onChange={(callbackUrl) => setQiniu({ callbackUrl })} placeholder="上传完成后七牛回调，可选" maxlength={255} disabled={disabled} />
            </FormField>
          </FormSection>
          <FormError>{storage.submitError}</FormError>
        </FormContent>
        {storage.canUpdate && storage.loaded ? (
          <FormSubmitBar text="保存配置" submitting={storage.saving} onSubmit={() => void storage.save(section)} />
        ) : null}
      </StateView>
    </ManagementPage>
  )
}

export default withAccountScope(StorageUploadPage)
