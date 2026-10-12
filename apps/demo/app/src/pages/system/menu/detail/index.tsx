import { getAdminMenu, updateAdminMenu } from '@/api/admin/menu'
import { DetailRow, DetailSection, menuResourceType } from '@/components/management'
import { SYSTEM_PAGES } from '@/constants/routes'
import { withAccountScope } from '../../_shared/AdminUI'
import { MenuDetailScaffold } from '../../_shared/MenuDetailScaffold'
import { MENU_TYPE_LABELS, menuCanHaveChildren } from '../filters'
import { removeMenu } from '../model'

function MenuDetailPage() {
  return (
    <MenuDetailScaffold
      noun="菜单"
      moduleId="system-menu"
      permission="system:menu"
      formPage={SYSTEM_PAGES.menuForm}
      fetch={getAdminMenu}
      setStatus={(id, status) => updateAdminMenu(id, { status })}
      remove={removeMenu}
      canHaveChildren={(menu) => menuCanHaveChildren(menu.type)}
      resourceType={(menu) => menuResourceType(menu.type)}
      typeLabel={(menu) => MENU_TYPE_LABELS[menu.type]}
    >
      {(menu) => {
        const childCount = menu.children?.length ?? 0
        return (
          <>
            <DetailSection title="基本信息">
              <DetailRow label="菜单名称" value={menu.name} />
              <DetailRow label="菜单类型" value={MENU_TYPE_LABELS[menu.type]} />
              <DetailRow label="状态" value={menu.status === '1' ? '启用' : '禁用'} />
              <DetailRow label="排序" value={menu.sort_order} />
              <DetailRow label="图标" value={menu.icon} />
              <DetailRow label="下级菜单" value={childCount ? `${childCount} 个` : '无'} />
            </DetailSection>
            <DetailSection title="路由设置">
              <DetailRow label="路由路径" value={menu.path} />
              {menu.type !== 0 ? <DetailRow label="组件路径" value={menu.component} /> : null}
              <DetailRow label="外部链接" value={menu.isExternalLink ? '是' : '否'} />
            </DetailSection>
            <DetailSection title="显示设置">
              <DetailRow label="在菜单中隐藏" value={menu.hideInMenu ? '是' : '否'} />
              <DetailRow label="缓存页面" value={menu.keepAlive ? '是' : '否'} />
              {menu.type === 2 ? (
                <DetailRow label="页面默认访问操作" value={menu.isDefaultAction ? '是' : '否'} />
              ) : null}
            </DetailSection>
            {menu.type !== 0 && menu.permissionCodes?.length ? (
              <DetailSection title={`关联功能（${menu.permissionCodes.length}）`}>
                {menu.permissionCodes.map((code) => (
                  <DetailRow key={code} label={code} />
                ))}
              </DetailSection>
            ) : null}
          </>
        )
      }}
    </MenuDetailScaffold>
  )
}
export default withAccountScope(MenuDetailPage)
