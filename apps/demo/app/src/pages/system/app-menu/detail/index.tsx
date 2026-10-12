import { getAdminAppMenu, updateAdminAppMenu } from '@/api/admin/appMenu'
import { DetailRow, DetailSection } from '@/components/management'
import { SYSTEM_PAGES } from '@/constants/routes'
import { withAccountScope } from '../../_shared/AdminUI'
import { MenuDetailScaffold } from '../../_shared/MenuDetailScaffold'
import {
  APP_MENU_TYPE_LABELS,
  appMenuResourceType,
  isAppMenuGroup,
  removeAppMenu,
} from '../model'

function AppMenuDetailPage() {
  return (
    <MenuDetailScaffold
      noun="工作台菜单"
      moduleId="system-app-menu"
      permission="system:app-menu"
      formPage={SYSTEM_PAGES.appMenuForm}
      fetch={getAdminAppMenu}
      setStatus={(id, status) => updateAdminAppMenu(id, { status })}
      remove={removeAppMenu}
      // 只有分组能容纳入口；入口是叶子
      canHaveChildren={isAppMenuGroup}
      resourceType={appMenuResourceType}
      typeLabel={(menu) => APP_MENU_TYPE_LABELS[menu.type]}
    >
      {(menu) => {
        const childCount = menu.children?.length ?? 0
        const group = isAppMenuGroup(menu)
        return (
          <>
            <DetailSection title="基本信息">
              <DetailRow label="名称" value={menu.name} />
              <DetailRow label="类型" value={APP_MENU_TYPE_LABELS[menu.type]} />
              <DetailRow label="状态" value={menu.status === '1' ? '启用' : '禁用'} />
              <DetailRow label="排序" value={menu.sortOrder} />
              <DetailRow label="图标" value={menu.icon} />
              {group ? (
                <DetailRow label="下级入口" value={childCount ? `${childCount} 个` : '无'} />
              ) : null}
            </DetailSection>
            {!group ? (
              <DetailSection title="入口设置">
                <DetailRow label="页面路径" value={menu.page} />
                <DetailRow label="所属模块" value={menu.moduleId} />
              </DetailSection>
            ) : null}
          </>
        )
      }}
    </MenuDetailScaffold>
  )
}
export default withAccountScope(AppMenuDetailPage)
