import { SysAppMenuModel } from "../models/sys-app-menu.model.js";
import { AppMenuListQuery, SaveAppMenuReq, SysAppMenuResp, UpdateAppMenuReq } from "../schemas/app-menu.js";
import { BusinessError } from "../exceptions/business-error.js";
import { AppMenuErrorCode } from "../constants/business-codes/app-menu.js";
import { AppErrorCode } from "../constants/business-codes/app.js";
import { SysAppModel } from "../models/sys-app.model.js";

export class AppMenuService {
  static async getMenuList(appId: number, query: AppMenuListQuery) {
    await this.ensureAppExists(appId);
    const list = await SysAppMenuModel.getMenuList(appId, query);
    const total = await SysAppMenuModel.getMenuTotal(appId, query);
    return {
      list,
      total,
      page: query.page || 1,
      pageSize: query.pageSize || 10,
    };
  }

  static async getMenuTree(appId: number, rootId?: number | null) {
    await this.ensureAppExists(appId);
    return await SysAppMenuModel.getMenuTree(appId, rootId);
  }

  static async getMenuById(appId: number, id: number) {
    await this.ensureAppExists(appId);
    return await SysAppMenuModel.getMenuById(appId, id);
  }

  static async createMenu(appId: number, req: SaveAppMenuReq, userId: number): Promise<SysAppMenuResp> {
    await this.ensureAppExists(appId);
    await this.ensureUnique(appId, req.name, req.parentId ?? null, req.path);
    await this.ensureParentValid(appId, req.parentId, undefined);
    return await SysAppMenuModel.createMenu(appId, req, userId);
  }

  static async updateMenu(appId: number, id: number, req: UpdateAppMenuReq, userId: number): Promise<SysAppMenuResp> {
    await this.ensureAppExists(appId);
    const existing = await SysAppMenuModel.getMenuById(appId, id);
    if (!existing) {
      throw new BusinessError(AppMenuErrorCode.APP_MENU_NOT_FOUND, "应用菜单不存在");
    }

    const targetParentId = req.parentId !== undefined ? (req.parentId ?? null) : (existing.parentId ?? null);
    const targetName = req.name ?? existing.name;
    const targetPath = req.path ?? existing.path;

    await this.ensureUnique(appId, targetName, targetParentId, targetPath, id);
    await this.ensureParentValid(appId, req.parentId, id);

    return await SysAppMenuModel.updateMenu(appId, id, req, userId);
  }

  static async deleteMenu(appId: number, id: number, userId: number): Promise<{ id: number }> {
    await this.ensureAppExists(appId);
    const existing = await SysAppMenuModel.getMenuById(appId, id);
    if (!existing) {
      throw new BusinessError(AppMenuErrorCode.APP_MENU_NOT_FOUND, "应用菜单不存在");
    }

    const childrenCount = await SysAppMenuModel.getMenuTotal(appId, { page: 1, pageSize: 1, parentId: id } as any);
    if (childrenCount > 0) {
      throw new BusinessError(AppMenuErrorCode.APP_MENU_DELETE_FORBIDDEN, "存在子菜单，禁止删除");
    }

    const res = await SysAppMenuModel.deleteMenu(appId, id, userId);
    if (!res) {
      throw new BusinessError(AppMenuErrorCode.APP_MENU_NOT_FOUND, "应用菜单不存在或已删除");
    }
    return res;
  }

  private static async ensureUnique(
    appId: number,
    name: string,
    parentId: number | null,
    path?: string,
    excludeId?: number
  ): Promise<void> {
    if (name) {
      const dupName = await SysAppMenuModel.getMenuByParentAndName(appId, parentId, name);
      if (dupName && dupName.id !== excludeId) {
        throw new BusinessError(AppMenuErrorCode.APP_MENU_ALREADY_EXISTS, "同父级下菜单名称已存在");
      }
    }

    if (path) {
      const dupPath = await SysAppMenuModel.getMenuByPath(appId, path);
      if (dupPath && dupPath.id !== excludeId) {
        throw new BusinessError(AppMenuErrorCode.APP_MENU_ALREADY_EXISTS, "菜单路径已存在");
      }
    }
  }

  private static async ensureParentValid(appId: number, parentId?: number, selfId?: number): Promise<void> {
    if (parentId === undefined || parentId === null) return;
    if (selfId !== undefined && parentId === selfId) {
      throw new BusinessError(AppMenuErrorCode.APP_MENU_INVALID_PARENT, "父级菜单不允许指向自身");
    }
    const parent = await SysAppMenuModel.getMenuById(appId, parentId);
    if (!parent) {
      throw new BusinessError(AppMenuErrorCode.APP_MENU_INVALID_PARENT, "父级菜单不存在");
    }
  }

  private static async ensureAppExists(appId: number): Promise<void> {
    const app = await SysAppModel.getAppById(appId);
    if (!app) {
      throw new BusinessError(AppErrorCode.APP_NOT_FOUND, "应用不存在");
    }
  }
}
