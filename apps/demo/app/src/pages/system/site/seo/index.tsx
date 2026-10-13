import { StateView } from '@/components/feedback'
import {
  FormContent,
  FormError,
  FormField,
  FormSection,
  FormSubmitBar,
  ManagementPage,
  ManagementPageHeader,
  TextAreaField,
  TextField,
} from '@/components/management'
import { withAccountScope } from '@/utils/account-scope'
import { sectionOf } from '../model'
import { useSiteConfig } from '../useSiteConfig'
import { KeywordsField } from './KeywordsField'
import { SeoPreview } from './SeoPreview'

const section = sectionOf('seo')

function SiteSeoPage() {
  const site = useSiteConfig()
  const { guard, config, setField, disabled } = site
  if (!guard.ready || !guard.allowed) return <ManagementPage>{null}</ManagementPage>
  return (
    <ManagementPage>
      {process.env.TARO_ENV === 'h5' ? <ManagementPageHeader title={section.title} /> : null}
      <StateView
        kind={site.error && !site.loaded ? 'error' : site.loading && !site.loaded ? 'loading' : 'ready'}
        text={site.error || undefined}
        onRetry={site.retry}
      >
        <FormContent>
          <SeoPreview
            title={config.siteTitle.trim()}
            domain={config.siteDomain}
            description={config.seoDescription.trim()}
          />
          <FormSection title="搜索引擎信息">
            <FormField label="站点标题" disabled={disabled}>
              <TextField value={config.siteTitle} onChange={(value) => setField('siteTitle', value)} placeholder="用于浏览器标题与搜索结果标题" maxlength={100} disabled={disabled} />
            </FormField>
            <KeywordsField value={config.seoKeywords} onChange={(value) => setField('seoKeywords', value)} disabled={disabled} />
            <FormField label="描述" stacked disabled={disabled}>
              <TextAreaField value={config.seoDescription} onChange={(value) => setField('seoDescription', value)} placeholder="用于搜索结果中的摘要，建议 80～120 字" maxlength={-1} disabled={disabled} />
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

export default withAccountScope(SiteSeoPage)
