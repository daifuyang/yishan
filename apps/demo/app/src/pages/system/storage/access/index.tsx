import { StateView } from '@/components/feedback'
import {
  FormContent,
  FormError,
  FormField,
  FormSection,
  FormSubmitBar,
  ManagementPage,
  SwitchField,
  TextField,
} from '@/components/management'
import { PageHeader } from '@/components/molecules'
import { withAccountScope } from '../../_shared/AdminUI'
import { activeCloud, QINIU_DEFAULTS, sectionOf } from '../model'
import { useStorageConfig } from '../useStorageConfig'

const section = sectionOf('access')

function StorageAccessPage() {
  const storage = useStorageConfig()
  const { guard, config, update, disabled } = storage
  if (!guard.ready || !guard.allowed) return <ManagementPage>{null}</ManagementPage>
  const cloud = activeCloud(config)
  const provider = config.provider
  /** 域名与 HTTPS 两家都有，按当前服务商写回对应配置 */
  const setCommon = (patch: { domain?: string; useHttps?: boolean }) =>
    update((previous) =>
      provider === 'qiniu'
        ? { ...previous, qiniu: { ...previous.qiniu, ...patch } }
        : { ...previous, aliyunOss: { ...previous.aliyunOss, ...patch } },
    )
  return (
    <ManagementPage>
      {process.env.TARO_ENV === 'h5' ? <PageHeader title={section.title} /> : null}
      <StateView
        kind={storage.error && !storage.loaded ? 'error' : storage.loading && !storage.loaded ? 'loading' : 'ready'}
        text={storage.error || undefined}
        onRetry={storage.retry}
      >
        <FormContent>
          <FormSection title="访问域名" hint="上传后的文件通过该域名对外访问">
            <FormField label="CDN 域名" disabled={disabled}>
              <TextField value={cloud.domain} onChange={(domain) => setCommon({ domain })} placeholder="如 https://cdn.example.com" maxlength={255} disabled={disabled} />
            </FormField>
          </FormSection>
          <FormSection title="访问方式">
            <SwitchField label="HTTPS" checked={cloud.useHttps} onChange={(useHttps) => setCommon({ useHttps })} disabled={disabled} />
            {provider === 'qiniu' ? (
              <SwitchField
                label="CDN 加速"
                checked={config.qiniu.useCdnDomains ?? QINIU_DEFAULTS.useCdnDomains}
                onChange={(useCdnDomains) => update((previous) => ({ ...previous, qiniu: { ...previous.qiniu, useCdnDomains } }))}
                disabled={disabled}
              />
            ) : null}
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

export default withAccountScope(StorageAccessPage)
