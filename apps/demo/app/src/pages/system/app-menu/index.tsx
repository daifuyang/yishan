import { getAdminAppMenuTree, type AdminAppMenu } from '@/api/admin/appMenu'
import { SYSTEM_PAGES } from '@/constants/routes'
import { withAccountScope } from '@/utils/account-scope'
import { MenuTreeListPage } from '../_shared/MenuTreeListPage'
import { APP_MENU_TYPE_OPTIONS, appMenuResourceType } from './model'

function appMenuMatches(node: AdminAppMenu, needle: string): boolean {
  return `${node.name} ${node.page || ''} ${node.moduleId || ''}`.toLowerCase().includes(needle)
}

function AppMenuPage() {
  return (
    <MenuTreeListPage
      title="工作台管理"
      noun="工作台菜单"
      moduleId="system-app-menu"
      createPermission="system:app-menu:create"
      searchPlaceholder="搜索名称、页面路径或模块"
      typeOptions={APP_MENU_TYPE_OPTIONS}
      typeTitle="工作台菜单类型"
      load={getAdminAppMenuTree}
      matches={appMenuMatches}
      renderNode={(node, depth) => ({
        title: node.name,
        description: depth === 1 ? node.page || node.moduleId : undefined,
        type: appMenuResourceType(node),
      })}
      createUrl={`/${SYSTEM_PAGES.appMenuForm}`}
      detailUrl={(node) => `/${SYSTEM_PAGES.appMenuDetail}?id=${node.id}`}
    />
  )
}
export default withAccountScope(AppMenuPage)
