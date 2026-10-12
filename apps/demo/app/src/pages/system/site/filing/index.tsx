import { StateView } from '@/components/feedback'
import {
  FormContent,
  FormError,
  FormField,
  FormSection,
  FormSubmitBar,
  ManagementPage,
  TextAreaField,
  TextField,
} from '@/components/management'
import { PageHeader } from '@/components/molecules'
import { withAccountScope } from '../../_shared/AdminUI'
import { sectionOf } from '../model'
import { useSiteConfig } from '../useSiteConfig'

const section = sectionOf('filing')

function SiteFilingPage() {
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
          <FormSection title="备案信息">
            <FormField label="ICP 备案" disabled={disabled}>
              <TextField value={config.icp} onChange={(value) => setField('icp', value)} placeholder="如 沪ICP备xxxxxx号" maxlength={100} disabled={disabled} />
            </FormField>
            <FormField label="公安备案" disabled={disabled}>
              <TextField value={config.publicSecurityIcp} onChange={(value) => setField('publicSecurityIcp', value)} placeholder="如 沪公网安备 xxxxxxxx 号" maxlength={100} disabled={disabled} />
            </FormField>
          </FormSection>
          <FormSection title="页脚" hint="支持 HTML，可放版权信息、备案链接等">
            <FormField label="页脚内容" stacked disabled={disabled}>
              <TextAreaField value={config.footerHtml} onChange={(value) => setField('footerHtml', value)} placeholder="请输入页脚内容" maxlength={-1} disabled={disabled} />
            </FormField>
          </FormSection>
          <FormError>{site.submitError}</FormError>
        </FormContent>
        {site.canUpdate && site.loaded ? (
          <FormSubmitBar text="保存" submitting={site.saving} onSubmit={() => void site.save(section.fields)} />
        ) : null}
      </StateView>
    </ManagementPage>
  )
}

export default withAccountScope(SiteFilingPage)
