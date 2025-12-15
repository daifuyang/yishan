import { SysOptionModel } from "../models/sys-option.model.js";
import { PortalTemplateModel } from "../models/portal-template.model.js";
import { BusinessError } from "../exceptions/business-error.js";
import { TemplateErrorCode } from "../constants/business-codes/template.js";

export type SystemOptionKey = string;

export class SystemOptionService {
  static async getOption(key: SystemOptionKey): Promise<string | null> {
    return await SysOptionModel.getOptionValue(key);
  }

  static async setOption(key: SystemOptionKey, value: string, userId: number): Promise<string> {
    // 针对模板类参数进行严格校验
    if (key === "defaultArticleTemplateId" || key === "defaultPageTemplateId") {
      const num = parseInt(String(value), 10);
      const t = await PortalTemplateModel.getTemplateRawById(num);
      if (!t) throw new BusinessError(TemplateErrorCode.TEMPLATE_NOT_FOUND, "模板不存在");
      if (key === "defaultArticleTemplateId" && t.type !== 1) {
        throw new BusinessError(TemplateErrorCode.TEMPLATE_TYPE_MISMATCH, "模板类型不匹配：需要文章模板");
      }
      if (key === "defaultPageTemplateId" && t.type !== 2) {
        throw new BusinessError(TemplateErrorCode.TEMPLATE_TYPE_MISMATCH, "模板类型不匹配：需要页面模板");
      }
    }
    // 其他系统配置（如七牛相关）按字符串存储
    return await SysOptionModel.setOptionValue(key, value, userId);
  }

  static async getOptions(keys: SystemOptionKey[]): Promise<Record<SystemOptionKey, string | null>> {
    const result = {} as Record<SystemOptionKey, string | null>;
    for (const k of keys) {
      result[k] = await this.getOption(k);
    }
    return result;
  }
}
