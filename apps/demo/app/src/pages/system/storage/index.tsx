import { Tag } from '@/components/atoms'
import { StateView } from '@/components/feedback'
import {
  DetailContent,
  DetailHero,
  DetailRow,
  DetailSection,
  ManagementCell,
  ManagementPage,
} from '@/components/management'
import { PageHeader } from '@/components/molecules'
import { navigateTo } from '@/utils/router'
import { withAccountScope } from '../_shared/AdminUI'
import { activeCloud, providerLabel, regionLabel, STORAGE_SECTIONS } from './model'
import { useStorageConfig } from './useStorageConfig'

/** 云存储概览：先看当前用的是哪家、存到哪个空间，再按分类进入编辑。 */
function StorageOverviewPage() {
  const { guard, config, loading, loaded, error, retry } = useStorageConfig({ refreshOnShow: true })
  if (!guard.ready || !guard.allowed) return <ManagementPage>{null}</ManagementPage>
  const enabled = config.provider !== 'disabled'
  const cloud = activeCloud(config)
  const sections = STORAGE_SECTIONS.filter((section) => section.providers.includes(config.provider))
  return (
    <ManagementPage>
      {process.env.TARO_ENV === 'h5' ? <PageHeader title="云存储" /> : null}
      <DetailContent>
        <StateView
          kind={error && !loaded ? 'error' : loading && !loaded ? 'loading' : 'ready'}
          text={error || undefined}
          onRetry={retry}
        >
          <DetailHero
            glyph="cloud"
            title={enabled ? providerLabel(config.provider) : '未启用云存储'}
            tag={<Tag variant={enabled ? 'success' : 'default'}>{enabled ? '已启用' : '未启用'}</Tag>}
            subtitle={enabled ? '上传的文件存储到该服务商' : '上传的文件保存在服务器本地'}
          />
          {enabled ? (
            <DetailSection title="当前存储">
              <DetailRow label="空间" value={cloud.bucket} />
              <DetailRow label="区域" value={regionLabel(config)} />
              <DetailRow label="访问域名" value={cloud.domain} />
            </DetailSection>
          ) : null}
          <DetailSection title="配置分类">
            {sections.map((section, index) => (
              <ManagementCell
                key={section.key}
                glyph={section.glyph}
                title={section.title}
                description={section.description}
                bordered={index < sections.length - 1}
                onClick={() => navigateTo(`/${section.page}`)}
              />
            ))}
          </DetailSection>
        </StateView>
      </DetailContent>
    </ManagementPage>
  )
}

export default withAccountScope(StorageOverviewPage)
