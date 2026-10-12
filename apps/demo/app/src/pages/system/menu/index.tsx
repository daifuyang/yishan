import { getAdminMenuTree } from '@/api/admin/menu'
import { menuResourceType } from '@/components/management'
import { SYSTEM_PAGES } from '@/constants/routes'
import { withAccountScope } from '../_shared/AdminUI'
import { MenuTreeListPage } from '../_shared/MenuTreeListPage'
import { menuMatches, MENU_TYPE_OPTIONS } from './filters'

function MenuPage() {
  return (
    <MenuTreeListPage
      title="菜单管理"
      noun="菜单"
      moduleId="system-menu"
      createPermission="system:menu:create"
      searchPlaceholder="搜索菜单名称、路由或组件"
      typeOptions={MENU_TYPE_OPTIONS}
      typeTitle="菜单类型"
      load={getAdminMenuTree}
      matches={menuMatches}
      renderNode={(node, depth) => ({
        title: node.name,
        // 页面显示路由，按钮显示权限标识；模块头不显示任何次要信息
        description:
          depth === 1
            ? node.path || node.component || '未设置路由'
            : depth >= 2
              ? node.permissionCodes?.[0]
              : undefined,
        type: menuResourceType(node.type),
      })}
      createUrl={`/${SYSTEM_PAGES.menuForm}`}
      detailUrl={(node) => `/${SYSTEM_PAGES.menuDetail}?id=${node.id}`}
    />
  )
}
export default withAccountScope(MenuPage)
