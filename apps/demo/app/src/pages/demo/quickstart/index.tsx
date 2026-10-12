import { PageContainer } from '@/components/layout'
import { View } from '@tarojs/components'
import {
  DetailContent,
  DetailRow,
  DetailSection,
  LinkRow,
  ManagementPage,
  ManagementPageHeader,
} from '@/components/management'
import { getAuthorizedMobileModules } from '@/modules/registry'
import { useAuthStore } from '@/stores/auth'
import { useModuleStore } from '@/stores/modules'
import { useRequireAuth } from '@/utils/auth-guard'
import { navigateTo } from '@/utils/router'
import { withAccountScope } from '../../system/_shared/AdminUI'
import styles from './index.module.scss'

const STEPS = [
  ['定义模块', '模块使用独立 ID，module.ts 声明公开模块契约；业务表以模块 ID 为前缀。'],
  ['实现业务接口', '按 routes → services → repositories → db/schema 组织，集中声明请求校验和权限。'],
  ['安装到产品', '产品的显式 manifest 决定安装模块，数据库启用状态决定已安装模块是否提供服务。'],
  ['配置页面与入口', 'Web 与移动端分别实现页面，工作台配置选择已注册的移动页面，按角色授权。'],
  ['执行迁移与验证', '数据库迁移单独执行；验证接口契约、权限、错误恢复以及 Web 和移动端实际流程。'],
] as const

function QuickstartPage() {
  const guard = useRequireAuth({ moduleId: 'demo-quickstart' })
  const menus = useModuleStore((state) => state.menus)
  const user = useAuthStore((state) => state.user)
  const enabled = useAuthStore((state) => state.enabledModuleIds)
  if (!guard.ready || !guard.allowed) return <PageContainer>{null}</PageContainer>
  const examples = getAuthorizedMobileModules(menus, user?.permissions, enabled).filter(
    (module) => module.backendModuleId === 'demo' && module.id !== 'demo-quickstart',
  )
  return (
    <ManagementPage>
      <ManagementPageHeader title="快速入门" />
      <View className={styles.content}>
        <DetailContent>
          {examples.length ? (
            <DetailSection title="示例页面">
              {examples.map((module) => (
                <LinkRow
                  key={module.id}
                  label={module.name}
                  onClick={() => navigateTo(`/${module.entry}`)}
                />
              ))}
            </DetailSection>
          ) : null}
          <DetailSection title="接入步骤">
            {STEPS.map(([title, content]) => (
              <DetailRow key={title} label={title} value={content} multiline />
            ))}
          </DetailSection>
        </DetailContent>
      </View>
    </ManagementPage>
  )
}

export default withAccountScope(QuickstartPage)
