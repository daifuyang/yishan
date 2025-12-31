import { SysLoginLogModel, CreateLoginLogData } from "../models/sys-login-log.model.js";
import { SysLoginLogListQuery, SysLoginLogResp } from "../schemas/login-log.js";
import { BusinessError } from "../exceptions/business-error.js";
import { SystemManageErrorCode } from "../constants/business-codes/system.js";

export class LoginLogService {
  static async writeLoginLog(data: CreateLoginLogData) {
    return await SysLoginLogModel.create(data);
  }

  static async getLoginLogList(query: SysLoginLogListQuery) {
    const [list, total] = await Promise.all([
      SysLoginLogModel.getList(query),
      SysLoginLogModel.getTotal(query),
    ]);

    return {
      list,
      total,
      page: query.page || 1,
      pageSize: query.pageSize || 10,
    };
  }

  static async getLoginLogById(id: number): Promise<SysLoginLogResp> {
    const item = await SysLoginLogModel.getById(id);
    if (!item) {
      throw new BusinessError(SystemManageErrorCode.LOGIN_LOG_NOT_FOUND, "登录日志不存在");
    }
    return item;
  }
}

