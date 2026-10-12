import type { OssConfig, QiniuConfig } from '@/api/admin/storage'
import { StateView } from '@/components/feedback'
import {
  EnumField,
  FormContent,
  FormError,
  FormField,
  FormSection,
  FormSubmitBar,
  ManagementPage,
  SecretField,
  TextField,
} from '@/components/management'
import { PageHeader } from '@/components/molecules'
import { withAccountScope } from '../../_shared/AdminUI'
import { PROVIDER_OPTIONS, QINIU_DEFAULTS, QINIU_REGIONS, sectionOf } from '../model'
import { useStorageConfig } from '../useStorageConfig'
import { ConnectionTest } from './ConnectionTest'

const section = sectionOf('basic')
/** 服务端不下发密钥：留空即沿用已保存的密钥，首次配置必须填写 */
const SECRET_PLACEHOLDER = '留空则保留已保存的密钥'

function StorageBasicPage() {
  const storage = useStorageConfig()
  const { guard, config, update, disabled } = storage
  if (!guard.ready || !guard.allowed) return <ManagementPage>{null}</ManagementPage>
  const setQiniu = (patch: Partial<QiniuConfig>) => update((previous) => ({ ...previous, qiniu: { ...previous.qiniu, ...patch } }))
  const setOss = (patch: Partial<OssConfig>) => update((previous) => ({ ...previous, aliyunOss: { ...previous.aliyunOss, ...patch } }))
  return (
    <ManagementPage>
      {process.env.TARO_ENV === 'h5' ? <PageHeader title={section.title} /> : null}
      <StateView
        kind={storage.error && !storage.loaded ? 'error' : storage.loading && !storage.loaded ? 'loading' : 'ready'}
        text={storage.error || undefined}
        onRetry={storage.retry}
      >
        <FormContent>
          <FormSection
            title="服务商"
            hint={config.provider !== storage.savedProvider && storage.savedProvider !== 'disabled' ? '切换服务商后保存，会清除原服务商的配置' : undefined}
          >
            <EnumField label="存储服务商" value={config.provider} options={PROVIDER_OPTIONS} onChange={(provider) => update((previous) => ({ ...previous, provider }))} disabled={disabled} />
          </FormSection>
          {config.provider === 'qiniu' ? (
            <FormSection title="七牛云">
              <SecretField label="AccessKey" required value={config.qiniu.accessKey || ''} onChange={(accessKey) => setQiniu({ accessKey })} placeholder="请输入 AccessKey" disabled={disabled} />
              <SecretField label="SecretKey" value={config.qiniu.secretKey || ''} onChange={(secretKey) => setQiniu({ secretKey })} placeholder={SECRET_PLACEHOLDER} disabled={disabled} />
              <FormField label="Bucket" required disabled={disabled}>
                <TextField value={config.qiniu.bucket || ''} onChange={(bucket) => setQiniu({ bucket })} placeholder="存储空间名称" maxlength={63} disabled={disabled} />
              </FormField>
              <EnumField label="存储区域" value={config.qiniu.region || QINIU_DEFAULTS.region} options={QINIU_REGIONS} onChange={(region) => setQiniu({ region })} disabled={disabled} />
            </FormSection>
          ) : null}
          {config.provider === 'aliyunOss' ? (
            <FormSection title="阿里云 OSS">
              <SecretField label="AccessKeyId" required value={config.aliyunOss.accessKeyId || ''} onChange={(accessKeyId) => setOss({ accessKeyId })} placeholder="请输入 AccessKeyId" disabled={disabled} />
              <SecretField label="AccessKeySecret" value={config.aliyunOss.accessKeySecret || ''} onChange={(accessKeySecret) => setOss({ accessKeySecret })} placeholder={SECRET_PLACEHOLDER} disabled={disabled} />
              <FormField label="Bucket" required disabled={disabled}>
                <TextField value={config.aliyunOss.bucket || ''} onChange={(bucket) => setOss({ bucket })} placeholder="存储空间名称" maxlength={63} disabled={disabled} />
              </FormField>
              <FormField label="存储区域" required disabled={disabled}>
                <TextField value={config.aliyunOss.region || ''} onChange={(region) => setOss({ region })} placeholder="如 oss-cn-hangzhou" maxlength={64} disabled={disabled} />
              </FormField>
              <FormField label="Endpoint" disabled={disabled}>
                <TextField value={config.aliyunOss.endpoint || ''} onChange={(endpoint) => setOss({ endpoint })} placeholder="如 oss-cn-hangzhou.aliyuncs.com" maxlength={255} disabled={disabled} />
              </FormField>
            </FormSection>
          ) : null}
          {storage.canUpdate && config.provider !== 'disabled' ? (
            <ConnectionTest testing={storage.testing} result={storage.testResult} disabled={!storage.loaded || storage.saving} onTest={() => void storage.test()} />
          ) : null}
          <FormError>{storage.submitError}</FormError>
        </FormContent>
        {storage.canUpdate && storage.loaded ? (
          <FormSubmitBar text="保存配置" submitting={storage.saving} onSubmit={() => void storage.save(section)} />
        ) : null}
      </StateView>
    </ManagementPage>
  )
}

export default withAccountScope(StorageBasicPage)
