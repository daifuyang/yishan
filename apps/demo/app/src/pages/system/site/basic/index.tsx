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
import { sectionOf } from '../model'
import { useSiteConfig } from '../useSiteConfig'
import { LogoField } from './LogoField'

const section = sectionOf('basic')

function SiteBasicPage() {
  const site = useSiteConfig()
  const { guard, config, setField, disabled } = site
  if (!guard.ready || !guard.allowed) return <ManagementPage>{null}</ManagementPage>
  return (
    <ManagementPage>
      {process.env.TARO_ENV === 'h5' ? <PageHeader title={section.title} /> : null}
      <StateView
        kind={site.error && !site.loaded ? 'error' : site.loading && !site.loaded ? 'loading' : 'ready'}
        text={site.error || undefined}
        onRetry={site.retry}
      >
        <FormContent>
          <FormSection title="站点信息">
            <LogoField
              value={config.siteLogo}
              onChange={(value) => setField('siteLogo', value)}
              onError={site.setSubmitError}
              disabled={disabled}
            />
            <FormField label="站点名称" required disabled={disabled}>
              <TextField value={config.siteName} onChange={(value) => setField('siteName', value)} placeholder="请输入站点名称" maxlength={100} disabled={disabled} />
            </FormField>
            <FormField label="站点域名" disabled={disabled}>
              <TextField value={config.siteDomain} onChange={(value) => setField('siteDomain', value)} placeholder="如 https://example.com" maxlength={255} disabled={disabled} />
            </FormField>
            <FormField label="Favicon" disabled={disabled}>
              <TextField value={config.siteFavicon} onChange={(value) => setField('siteFavicon', value)} placeholder="如 /favicon.ico" maxlength={255} disabled={disabled} />
            </FormField>
          </FormSection>
          <FormSection title="联系方式">
            <FormField label="联系电话" disabled={disabled}>
              <TextField value={config.contactPhone} onChange={(value) => setField('contactPhone', value)} placeholder="如 400-xxx-xxxx" maxlength={50} disabled={disabled} />
            </FormField>
            <FormField label="联系邮箱" disabled={disabled}>
              <TextField value={config.contactEmail} onChange={(value) => setField('contactEmail', value)} placeholder="如 contact@example.com" maxlength={100} disabled={disabled} />
            </FormField>
            <FormField label="联系地址" disabled={disabled}>
              <TextField value={config.contactAddress} onChange={(value) => setField('contactAddress', value)} placeholder="用于页脚或联系我们" maxlength={255} disabled={disabled} />
            </FormField>
          </FormSection>
          <FormError>{site.submitError}</FormError>
        </FormContent>
        {site.canUpdate && site.loaded ? (
          <FormSubmitBar
            text="保存"
            submitting={site.saving}
            onSubmit={() => void site.save(section.fields, (value) => (value.siteName.trim() ? '' : '请输入站点名称'))}
          />
        ) : null}
      </StateView>
    </ManagementPage>
  )
}

export default withAccountScope(SiteBasicPage)
