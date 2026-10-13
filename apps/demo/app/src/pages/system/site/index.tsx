import { StateView } from '@/components/feedback'
import {
  DetailContent,
  DetailHero,
  DetailSection,
  ManagementCell,
  ManagementPage,
  ManagementPageHeader,
} from '@/components/management'
import { navigateTo } from '@/utils/router'
import { withAccountScope } from '@/utils/account-scope'
import { displayDomain, previewImage, SITE_SECTIONS } from './model'
import { useSiteConfig } from './useSiteConfig'

/** 站点配置概览：顶部看站点现状，下方按分类进入单项编辑。 */
function SiteOverviewPage() {
  const { guard, config, loading, loaded, error, retry } = useSiteConfig({ refreshOnShow: true })
  if (!guard.ready || !guard.allowed) return <ManagementPage>{null}</ManagementPage>
  const name = config.siteName.trim()
  const domain = displayDomain(config.siteDomain)
  return (
    <ManagementPage>
      {process.env.TARO_ENV === 'h5' ? <ManagementPageHeader title="站点配置" /> : null}
      <DetailContent>
        <StateView
          kind={error && !loaded ? 'error' : loading && !loaded ? 'loading' : 'ready'}
          text={error || undefined}
          onRetry={retry}
        >
          <DetailHero
            avatar={{ src: previewImage(config.siteLogo), name: name || '站' }}
            title={name || '未设置站点名称'}
            subtitle={domain || '未设置站点域名'}
          />
          <DetailSection title="配置分类">
            {SITE_SECTIONS.map((section, index) => (
              <ManagementCell
                key={section.key}
                glyph={section.glyph}
                title={section.title}
                description={section.description}
                bordered={index < SITE_SECTIONS.length - 1}
                onClick={() => navigateTo(`/${section.page}`)}
              />
            ))}
          </DetailSection>
        </StateView>
      </DetailContent>
    </ManagementPage>
  )
}

export default withAccountScope(SiteOverviewPage)
