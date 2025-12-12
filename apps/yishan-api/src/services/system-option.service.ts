import { SysOptionModel } from "../models/sys-option.model.js";
import { PortalTemplateModel } from "../models/portal-template.model.js";
import { BusinessError } from "../exceptions/business-error.js";
import { TemplateErrorCode } from "../constants/business-codes/template.js";

export type SystemOptionKey = "defaultArticleTemplateId" | "defaultPageTemplateId";

export class SystemOptionService {
  static async getOption(key: SystemOptionKey): Promise<number | null> {
    return await SysOptionModel.getOptionValue(key);
  }

  static async setOption(key: SystemOptionKey, value: number, userId: number): Promise<number> {
    // 校验模板存在与类型匹配
    const t = await PortalTemplateModel.getTemplateRawById(value);
    if (!t) throw new BusinessError(TemplateErrorCode.TEMPLATE_NOT_FOUND, "模板不存在");
    if (key === "defaultArticleTemplateId" && t.type !== 1) {
      throw new BusinessError(TemplateErrorCode.TEMPLATE_TYPE_MISMATCH, "模板类型不匹配：需要文章模板");
    }
    if (key === "defaultPageTemplateId" && t.type !== 2) {
      throw new BusinessError(TemplateErrorCode.TEMPLATE_TYPE_MISMATCH, "模板类型不匹配：需要页面模板");
    }
    return await SysOptionModel.setOptionValue(key, value, userId);
  }
}

