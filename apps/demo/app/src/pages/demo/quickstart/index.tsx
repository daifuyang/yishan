import { Text, View } from '@tarojs/components'
import { Button } from '@/components/atoms'
import { useRequireAuth } from '@/utils/auth-guard'
import { navigateTo } from '@/utils/router'
import { useModuleStore } from '@/stores/modules'
import { useAuthStore } from '@/stores/auth'
import { getAuthorizedMobileModules } from '@/modules/registry'
import { AdminNotice, AdminPage } from '../../system/_shared/AdminUI'

export default function QuickstartPage() {
  const auth = useRequireAuth({ moduleId: 'demo-quickstart' })
  const menus = useModuleStore((state) => state.menus)
  const user = useAuthStore((state) => state.user)
  const enabled = useAuthStore((state) => state.enabledModuleIds)
  const examples = getAuthorizedMobileModules(menus, user?.permissions, enabled).filter((module) => module.backendModuleId === 'demo' && module.id !== 'demo-quickstart')
  return <AdminPage title="快速入门">
    <View className="admin-card"><Text className="admin-name">示例插件</Text><AdminNotice>通过运行状态、Todo 管理和省市级联，体验插件在移动端的完整使用流程。</AdminNotice>{auth.allowed ? examples.map((module) => <View className="admin-row" key={module.id}><Text>{module.name}</Text><Button size="sm" variant="secondary" onClick={() => navigateTo(`/${module.entry}`)}>打开</Button></View>) : null}</View>
    <View className="admin-card"><Text className="admin-section-title">模块接入规范</Text>
      {[
        ['1. 定义模块', '模块使用独立 ID，module.ts 声明公开模块契约；业务表以模块 ID 为前缀。'],
        ['2. 实现业务接口', '按 routes → services → repositories → db/schema 组织，集中声明请求校验和权限。'],
        ['3. 安装到产品', '产品的显式 manifest 决定安装模块，数据库启用状态决定已安装模块是否提供服务。'],
        ['4. 配置页面与入口', 'Web 与移动端分别实现页面，工作台配置选择已注册的移动页面，按角色授权。'],
        ['5. 执行迁移与验证', '数据库迁移单独执行；验证接口契约、权限、错误恢复以及 Web 和移动端实际流程。'],
      ].map(([title, content]) => <View key={title}><Text className="admin-name">{title}</Text><AdminNotice>{content}</AdminNotice></View>)}
    </View>
  </AdminPage>
}
