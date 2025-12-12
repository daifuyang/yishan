import { PortalTemplateModel } from "../models/portal-template.model.js";
import { TemplateListQuery, CreateTemplateReq, UpdateTemplateReq, PortalTemplateResp } from "../schemas/template.js";
import { BusinessError } from "../exceptions/business-error.js";
import { TemplateErrorCode } from "../constants/business-codes/template.js";

export class TemplateService {
  static async getTemplateList(query: TemplateListQuery) {
    const list = await PortalTemplateModel.getTemplateList(query);
    const total = await PortalTemplateModel.getTemplateTotal(query);
    return { list, total, page: query.page || 1, pageSize: query.pageSize || 10 };
  }

  static async getTemplateById(id: number): Promise<PortalTemplateResp> {
    const t = await PortalTemplateModel.getTemplateById(id);
    if (!t) throw new BusinessError(TemplateErrorCode.TEMPLATE_NOT_FOUND, "模板不存在");
    return t;
  }

  static async createTemplate(req: CreateTemplateReq, userId: number): Promise<PortalTemplateResp> {
    const dupe = await PortalTemplateModel.getTemplateByNameAndType(req.name, req.type);
    if (dupe) throw new BusinessError(TemplateErrorCode.TEMPLATE_ALREADY_EXISTS, "模板已存在");
    return await PortalTemplateModel.createTemplate(req, userId);
  }

  static async updateTemplate(id: number, req: UpdateTemplateReq, userId: number): Promise<PortalTemplateResp> {
    const existed = await PortalTemplateModel.getTemplateRawById(id);
    if (!existed) throw new BusinessError(TemplateErrorCode.TEMPLATE_NOT_FOUND, "模板不存在");
    if ((existed as any).isSystemDefault) {
      throw new BusinessError(TemplateErrorCode.TEMPLATE_UPDATE_FORBIDDEN, "系统默认模板不允许修改");
    }
    if (req.name || req.type) {
      const type = (req.type ?? (existed.type === 1 ? "article" : "page")) as "article" | "page";
      const dupe = await PortalTemplateModel.getTemplateByNameAndType(req.name ?? existed.name, type);
      if (dupe && dupe.id !== id) throw new BusinessError(TemplateErrorCode.TEMPLATE_ALREADY_EXISTS, "模板已存在");
    }
    return await PortalTemplateModel.updateTemplate(id, req, userId);
  }

  static async deleteTemplate(id: number) {
    const existed = await PortalTemplateModel.getTemplateRawById(id);
    if (existed && (existed as any).isSystemDefault) {
      throw new BusinessError(TemplateErrorCode.TEMPLATE_DELETE_FORBIDDEN, "系统默认模板不允许删除");
    }
    const result = await PortalTemplateModel.deleteTemplate(id);
    if (!result) throw new BusinessError(TemplateErrorCode.TEMPLATE_NOT_FOUND, "模板不存在");
    return result;
  }

  static async getTemplateSchema(id: number): Promise<any[]> {
    const schema = await PortalTemplateModel.getTemplateSchema(id);
    if (!schema) throw new BusinessError(TemplateErrorCode.TEMPLATE_NOT_FOUND, "模板不存在");
    return schema;
  }

  static async updateTemplateSchema(id: number, schema: any[], userId: number): Promise<any[]> {
    const updated = await PortalTemplateModel.updateTemplateSchema(id, schema, userId);
    if (!updated) throw new BusinessError(TemplateErrorCode.TEMPLATE_NOT_FOUND, "模板不存在");
    return updated;
  }
}
