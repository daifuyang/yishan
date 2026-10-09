/**
 * 菜单实体到 API 响应 DTO 的映射器
 */

import { dateUtils } from "../../utils/date.js";
import type { SysMenuResp } from "../schemas/menu.js";

// 类型定义 - 这些类型来自 MenuRepository 的返回值
type MenuListRow = {
  id: number;
  name: string;
  type: number;
  parentId: number | null;
  path: string | null;
  icon: string | null;
  component: string | null;
  status: number;
  sortOrder: number;
  hideInMenu: boolean;
  isDefaultAction: boolean;
  isExternalLink: boolean;
  permissionCodes?: string[];
  keepAlive: boolean;
  creatorId: number | null;
  createdAt: Date;
  updaterId: number | null;
  updatedAt: Date;
  parentName: string | null;
  creatorName: string | null;
  updaterName: string | null;
};

type MenuDetailRow = MenuListRow;

export class MenuMapper {
  static toListResp(menu: MenuListRow): SysMenuResp {
    return {
      id: menu.id,
      name: menu.name,
      type: menu.type,
      path: menu.path ?? undefined,
      icon: menu.icon ?? undefined,
      component: menu.component ?? undefined,
      parentId: menu.parentId ?? undefined,
      parentName: menu.parentName ?? undefined,
      status: menu.status.toString(),
      sort_order: menu.sortOrder ?? 0,
      hideInMenu: !!menu.hideInMenu,
      isDefaultAction: !!menu.isDefaultAction,
      isExternalLink: !!menu.isExternalLink,
      permissionCodes: menu.permissionCodes ?? [],
      keepAlive: !!menu.keepAlive,
      creatorId: menu.creatorId ?? undefined,
      creatorName: menu.creatorName ?? undefined,
      createdAt: dateUtils.formatISO(menu.createdAt)!,
      updaterId: menu.updaterId ?? undefined,
      updaterName: menu.updaterName ?? undefined,
      updatedAt: dateUtils.formatISO(menu.updatedAt)!,
    };
  }

  static toDetailResp(menu: MenuDetailRow): SysMenuResp {
    return this.toListResp(menu);
  }
}
