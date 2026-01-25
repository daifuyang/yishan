import { SysAppModel } from "../models/sys-app.model.js";
import { SaveAppReq, AppListQuery, SysAppResp, UpdateAppReq } from "../schemas/app.js";
import { BusinessError } from "../exceptions/business-error.js";
import { AppErrorCode } from "../constants/business-codes/app.js";

export class AppService {
  static async getAppList(query: AppListQuery) {
    const list = await SysAppModel.getAppList(query);
    const total = await SysAppModel.getAppTotal(query);
    return {
      list,
      total,
      page: query.page || 1,
      pageSize: query.pageSize || 10,
    };
  }

  static async getAppById(id: number) {
    return await SysAppModel.getAppById(id);
  }

  static async createApp(req: SaveAppReq, userId: number): Promise<SysAppResp> {
    await this.ensureUnique(req.name);
    return await SysAppModel.createApp(req, userId);
  }

  static async updateApp(id: number, req: UpdateAppReq, userId: number): Promise<SysAppResp> {
    const existing = await SysAppModel.getAppById(id);
    if (!existing) {
      throw new BusinessError(AppErrorCode.APP_NOT_FOUND, "应用不存在");
    }
    if (req.name) {
      await this.ensureUnique(req.name, id);
    }
    return await SysAppModel.updateApp(id, req, userId);
  }

  static async deleteApp(id: number, userId: number): Promise<{ id: number }> {
    const existing = await SysAppModel.getAppById(id);
    if (!existing) {
      throw new BusinessError(AppErrorCode.APP_NOT_FOUND, "应用不存在");
    }
    const res = await SysAppModel.deleteApp(id, userId);
    if (!res) {
      throw new BusinessError(AppErrorCode.APP_NOT_FOUND, "应用不存在或已删除");
    }
    return res;
  }

  private static async ensureUnique(name?: string, excludeId?: number): Promise<void> {
    if (!name) return;
    const dup = await SysAppModel.getAppByName(name);
    if (dup && dup.id !== excludeId) {
      throw new BusinessError(AppErrorCode.APP_ALREADY_EXISTS, "应用已存在");
    }
  }
}
