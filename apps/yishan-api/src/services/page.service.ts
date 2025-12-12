import { PortalPageModel } from "../models/portal-page.model.js";
import { CreatePageReq, PageListQuery, PortalPageResp, UpdatePageReq } from "../schemas/page.js";
import { AssignTemplateReq } from "../schemas/template.js";
import { BusinessError } from "../exceptions/business-error.js";
import { PageErrorCode } from "../constants/business-codes/page.js";
import { TemplateErrorCode } from "../constants/business-codes/template.js";
import { PortalTemplateModel } from "../models/portal-template.model.js";

export class PageService {
  static async getPageList(query: PageListQuery) {
    const list = await PortalPageModel.getPageList(query);
    const total = await PortalPageModel.getPageTotal(query);
    return { list, total, page: query.page || 1, pageSize: query.pageSize || 10 };
  }

  static async getPageById(id: number): Promise<PortalPageResp> {
    const page = await PortalPageModel.getPageById(id);
    if (!page) throw new BusinessError(PageErrorCode.PAGE_NOT_FOUND, "页面不存在");
    return page;
  }

  static async getPageByPath(path: string) {
    return await PortalPageModel.getPageByPath(path);
  }

  static async createPage(req: CreatePageReq, userId: number): Promise<PortalPageResp> {
    const dupe = await PortalPageModel.getPageByPath(req.path);
    if (dupe) throw new BusinessError(PageErrorCode.PAGE_ALREADY_EXISTS, "页面路径已存在");
    return await PortalPageModel.createPage(req, userId);
  }

  static async updatePage(id: number, req: UpdatePageReq, userId: number): Promise<PortalPageResp> {
    const existed = await PortalPageModel.getPageById(id);
    if (!existed) throw new BusinessError(PageErrorCode.PAGE_NOT_FOUND, "页面不存在");
    if (req.path) {
      const dupe = await PortalPageModel.getPageByPath(req.path);
      if (dupe && dupe.id !== id) throw new BusinessError(PageErrorCode.PAGE_ALREADY_EXISTS, "页面路径已存在");
    }
    return await PortalPageModel.updatePage(id, req, userId);
  }

  static async deletePage(id: number) {
    const result = await PortalPageModel.deletePage(id);
    if (!result) throw new BusinessError(PageErrorCode.PAGE_NOT_FOUND, "页面不存在");
    return result;
  }

  static async assignTemplate(id: number, req: AssignTemplateReq, userId: number): Promise<PortalPageResp> {
    const existed = await PortalPageModel.getPageById(id);
    if (!existed) throw new BusinessError(PageErrorCode.PAGE_NOT_FOUND, "页面不存在");
    if (req.templateId !== null && req.templateId !== undefined) {
      const t = await PortalTemplateModel.getTemplateRawById(req.templateId);
      if (!t) throw new BusinessError(TemplateErrorCode.TEMPLATE_NOT_FOUND, "模板不存在");
      if (t.type !== 2) throw new BusinessError(TemplateErrorCode.TEMPLATE_TYPE_MISMATCH, "模板类型不匹配");
      if (t.deletedAt || t.status !== 1) throw new BusinessError(TemplateErrorCode.TEMPLATE_NOT_FOUND, "模板不可用");
    }
    return await PortalPageModel.assignTemplate(id, req.templateId ?? null, userId);
  }
}
