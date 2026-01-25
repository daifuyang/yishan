import { SysAppResourceModel } from "../models/sys-app-resource.model.js";
import { AppResourceListQuery, CreateAppResourceReq, SysAppResourceResp, UpdateAppResourceReq } from "../schemas/app-resource.js";
import { BusinessError } from "../exceptions/business-error.js";
import { AppResourceErrorCode } from "../constants/business-codes/app-resource.js";
import { AppErrorCode } from "../constants/business-codes/app.js";
import { SysAppModel } from "../models/sys-app.model.js";

export class AppResourceService {
  static async getResourceList(appId: number, query: AppResourceListQuery) {
    await this.ensureAppExists(appId);
    const list = await SysAppResourceModel.getResourceList(appId, query);
    const total = await SysAppResourceModel.getResourceTotal(appId, query);
    return {
      list,
      total,
      page: query.page || 1,
      pageSize: query.pageSize || 10,
    };
  }

  static async getResourceById(appId: number, id: number) {
    await this.ensureAppExists(appId);
    return await SysAppResourceModel.getResourceById(appId, id);
  }

  static async getResourceTree(appId: number, rootId?: number | null) {
    await this.ensureAppExists(appId);
    return await SysAppResourceModel.getResourceTree(appId, rootId);
  }

  static async createResource(appId: number, req: CreateAppResourceReq, userId: number): Promise<SysAppResourceResp> {
    await this.ensureAppExists(appId);
    return await SysAppResourceModel.createResource(appId, req, userId);
  }

  static async updateResource(appId: number, id: number, req: UpdateAppResourceReq, userId: number): Promise<SysAppResourceResp> {
    await this.ensureAppExists(appId);
    const existing = await SysAppResourceModel.getResourceById(appId, id);
    if (!existing) {
      throw new BusinessError(AppResourceErrorCode.APP_RESOURCE_NOT_FOUND, "应用资源不存在");
    }
    return await SysAppResourceModel.updateResource(appId, id, req, userId);
  }

  static async deleteResource(appId: number, id: number, userId: number): Promise<{ id: number }> {
    await this.ensureAppExists(appId);
    const existing = await SysAppResourceModel.getResourceById(appId, id);
    if (!existing) {
      throw new BusinessError(AppResourceErrorCode.APP_RESOURCE_NOT_FOUND, "应用资源不存在");
    }
    const res = await SysAppResourceModel.deleteResource(appId, id, userId);
    if (!res) {
      throw new BusinessError(AppResourceErrorCode.APP_RESOURCE_NOT_FOUND, "应用资源不存在或已删除");
    }
    return res;
  }

  private static async ensureAppExists(appId: number): Promise<void> {
    const app = await SysAppModel.getAppById(appId);
    if (!app) {
      throw new BusinessError(AppErrorCode.APP_NOT_FOUND, "应用不存在");
    }
  }
}
