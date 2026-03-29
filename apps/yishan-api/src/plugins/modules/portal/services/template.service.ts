import { PortalTemplateModel } from "../models/portal-template.model.js";
import { CreateTemplateReq, PortalTemplateResp, TemplateListQuery, UpdateTemplateReq } from "../schemas/template.js";
import { BusinessError } from "../exceptions/business-error.js";
import { TemplateErrorCode } from "../constants/business-codes/template.js";

export class TemplateService {
  static async getTemplateList(query: TemplateListQuery) {
    const list = await PortalTemplateModel.getTemplateList(query);
    const total = await PortalTemplateModel.getTemplateTotal(query);
    return { list, total, page: query.page || 1, pageSize: query.pageSize || 10 };
  }

  static async getTemplateById(id: number): Promise<PortalTemplateResp> {
    const template = await PortalTemplateModel.getTemplateById(id);
    if (!template) throw new BusinessError(TemplateErrorCode.TEMPLATE_NOT_FOUND, "模板不存在");
    return template;
  }

  static async createTemplate(req: CreateTemplateReq, userId: number): Promise<PortalTemplateResp> {
    const dupe = await PortalTemplateModel.getTemplateByNameAndType(req.name, req.type);
    if (dupe) throw new BusinessError(TemplateErrorCode.TEMPLATE_ALREADY_EXISTS, "同类型模板名称已存在");
    return await PortalTemplateModel.createTemplate(req, userId);
  }

  static async updateTemplate(id: number, req: UpdateTemplateReq, userId: number): Promise<PortalTemplateResp> {
    const existedRaw = await PortalTemplateModel.getTemplateRawById(id);
    if (!existedRaw) throw new BusinessError(TemplateErrorCode.TEMPLATE_NOT_FOUND, "模板不存在");
    if (existedRaw.isSystemDefault) {
      throw new BusinessError(TemplateErrorCode.TEMPLATE_UPDATE_FORBIDDEN, "系统默认模板不允许修改");
    }
    if (req.name) {
      const targetType = req.type ?? (existedRaw.type === 1 ? "article" : "page");
      const dupe = await PortalTemplateModel.getTemplateByNameAndType(req.name, targetType as "article" | "page");
      if (dupe && dupe.id !== id) throw new BusinessError(TemplateErrorCode.TEMPLATE_ALREADY_EXISTS, "同类型模板名称已存在");
    }
    return await PortalTemplateModel.updateTemplate(id, req, userId);
  }

  static async deleteTemplate(id: number) {
    const existedRaw = await PortalTemplateModel.getTemplateRawById(id);
    if (!existedRaw) throw new BusinessError(TemplateErrorCode.TEMPLATE_NOT_FOUND, "模板不存在");
    if (existedRaw.isSystemDefault) {
      throw new BusinessError(TemplateErrorCode.TEMPLATE_DELETE_FORBIDDEN, "系统默认模板不允许删除");
    }
    const result = await PortalTemplateModel.deleteTemplate(id);
    if (!result) throw new BusinessError(TemplateErrorCode.TEMPLATE_NOT_FOUND, "模板不存在");
    return result;
  }

  static async getTemplateSchema(id: number) {
    const schema = await PortalTemplateModel.getTemplateSchema(id);
    if (!schema) throw new BusinessError(TemplateErrorCode.TEMPLATE_NOT_FOUND, "模板不存在");
    return schema;
  }

  static async updateTemplateSchema(id: number, schema: any[], userId: number) {
    const existedRaw = await PortalTemplateModel.getTemplateRawById(id);
    if (!existedRaw) throw new BusinessError(TemplateErrorCode.TEMPLATE_NOT_FOUND, "模板不存在");
    if (existedRaw.isSystemDefault) {
      throw new BusinessError(TemplateErrorCode.TEMPLATE_UPDATE_FORBIDDEN, "系统默认模板不允许修改");
    }
    return await PortalTemplateModel.updateTemplateSchema(id, schema, userId);
  }
}
