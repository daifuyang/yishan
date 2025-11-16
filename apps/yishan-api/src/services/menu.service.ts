/**
 * 菜单业务逻辑服务
 */

import { SysMenuModel } from "../models/sys-menu.model.js";
import { SaveMenuReq, MenuListQuery, SysMenuResp, UpdateMenuReq } from "../schemas/menu.js";
import { BusinessError } from "../exceptions/business-error.js";
import { MenuErrorCode } from "../constants/business-codes/menu.js";

export class MenuService {
  /** 获取菜单列表 */
  static async getMenuList(query: MenuListQuery) {
    const list = await SysMenuModel.getMenuList(query);
    const total = await SysMenuModel.getMenuTotal(query);

    return {
      list,
      total,
      page: query.page || 1,
      pageSize: query.pageSize || 10,
    };
  }

  static async getMenuTree(rootId?: number | null) {
    return await SysMenuModel.getMenuTree(rootId);
  }

  /** 获取菜单详情 */
  static async getMenuById(id: number) {
    return await SysMenuModel.getMenuById(id);
  }

  /** 创建菜单（校验名称/路径唯一 & 父级合法） */
  static async createMenu(req: SaveMenuReq): Promise<SysMenuResp> {
    await this.ensureUnique(req.name, req.parentId ?? null, req.path);
    await this.ensureParentValid(req.parentId, undefined);
    return await SysMenuModel.createMenu(req);
  }

  /** 更新菜单（校验名称/路径唯一 & 父级合法） */
  static async updateMenu(id: number, req: UpdateMenuReq): Promise<SysMenuResp> {
    const existing = await SysMenuModel.getMenuById(id);
    if (!existing) {
      throw new BusinessError(MenuErrorCode.MENU_NOT_FOUND, "菜单不存在");
    }

    const targetParentId = req.parentId !== undefined ? (req.parentId ?? null) : (existing.parentId ?? null);
    const targetName = req.name ?? existing.name;
    const targetPath = req.path ?? existing.path;

    await this.ensureUnique(targetName, targetParentId, targetPath, id);
    await this.ensureParentValid(req.parentId, id);

    return await SysMenuModel.updateMenu(id, req);
  }

  /** 删除菜单（存在子菜单或已绑定角色则禁止） */
  static async deleteMenu(id: number): Promise<{ id: number }> {
    const existing = await SysMenuModel.getMenuById(id);
    if (!existing) {
      throw new BusinessError(MenuErrorCode.MENU_NOT_FOUND, "菜单不存在");
    }

    // 检查是否存在子菜单
    const childrenCount = await SysMenuModel.getMenuTotal({ page: 1, pageSize: 1, parentId: id } as any);
    if (childrenCount > 0) {
      throw new BusinessError(MenuErrorCode.MENU_DELETE_FORBIDDEN, "存在子菜单，禁止删除");
    }

    // 检查是否有角色绑定
    const roleBindCount = await SysMenuModel.getRoleBindCount(id);
    if (roleBindCount > 0) {
      throw new BusinessError(MenuErrorCode.MENU_DELETE_FORBIDDEN, "该菜单已绑定角色，禁止删除");
    }

    const res = await SysMenuModel.deleteMenu(id);
    if (!res) {
      throw new BusinessError(MenuErrorCode.MENU_NOT_FOUND, "菜单不存在或已删除");
    }
    return res;
  }

  /** 校验名称与路径唯一性（同父级下名称唯一，路径全局唯一；排除自身） */
  private static async ensureUnique(name: string, parentId: number | null, path?: string, excludeId?: number): Promise<void> {
    if (name) {
      const dupName = await SysMenuModel.getMenuByParentAndName(parentId, name);
      if (dupName && dupName.id !== excludeId) {
        throw new BusinessError(MenuErrorCode.MENU_ALREADY_EXISTS, "同父级下菜单名称已存在");
      }
    }

    if (path) {
      const dupPath = await SysMenuModel.getMenuByPath(path);
      if (dupPath && dupPath.id !== excludeId) {
        throw new BusinessError(MenuErrorCode.MENU_ALREADY_EXISTS, "菜单路径已存在");
      }
    }
  }

  /** 校验父级菜单合法性：存在且不为自身 */
  private static async ensureParentValid(parentId?: number, selfId?: number): Promise<void> {
    if (parentId === undefined || parentId === null) return;
    if (selfId !== undefined && parentId === selfId) {
      throw new BusinessError(MenuErrorCode.MENU_INVALID_PARENT, "父级菜单不允许指向自身");
    }
    const parent = await SysMenuModel.getMenuById(parentId);
    if (!parent) {
      throw new BusinessError(MenuErrorCode.MENU_INVALID_PARENT, "父级菜单不存在");
    }
    // TODO: 可选：校验是否会产生循环引用（需要查询祖先/后代链路）。
  }
}