import { LoginLogRepository, CreateLoginLogData } from "../repositories/login-log.repository.js";
import { LoginLogMapper } from "../mappers/login-log.mapper.js";
import { SysLoginLogListQuery, SysLoginLogResp } from "../schemas/login-log.js";
import { BusinessError } from "../../exceptions/business-error.js";
import { SystemManageErrorCode } from "../../constants/business-codes/system.js";

export class LoginLogService {
  static async writeLoginLog(data: CreateLoginLogData) {
    return await LoginLogRepository.create(data);
  }

  static async getLoginLogList(query: SysLoginLogListQuery) {
    const safePage = Math.max(1, query.page || 1);
    const safePageSize = Math.max(1, Math.min(100, query.pageSize || 10));

    const [rows, total] = await Promise.all([
      LoginLogRepository.list({
        page: safePage,
        pageSize: safePageSize,
        keyword: query.keyword,
        status: query.status ? parseInt(query.status, 10) : undefined,
        startTime: query.startTime ? new Date(query.startTime) : undefined,
        endTime: query.endTime ? new Date(query.endTime) : undefined,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      }),
      LoginLogRepository.count({
        keyword: query.keyword,
        status: query.status ? parseInt(query.status, 10) : undefined,
        startTime: query.startTime ? new Date(query.startTime) : undefined,
        endTime: query.endTime ? new Date(query.endTime) : undefined,
      }),
    ]);

    return {
      list: LoginLogMapper.toRespList(rows),
      total,
      page: safePage,
      pageSize: safePageSize,
    };
  }

  static async getLoginLogById(id: number): Promise<SysLoginLogResp> {
    const row = await LoginLogRepository.findById(id);
    if (!row) {
      throw new BusinessError(SystemManageErrorCode.LOGIN_LOG_NOT_FOUND, "登录日志不存在");
    }
    return LoginLogMapper.toResp(row);
  }

  /**
   * Paginated "my login logs" for a single user. Keyword/status filters
   * are intentionally not exposed here — admin-only list uses getLoginLogList.
   */
  static async getMyLoginLogs(userId: number, query: { page?: number; pageSize?: number }) {
    const safePage = Math.max(1, query.page || 1);
    const safePageSize = Math.max(1, Math.min(100, query.pageSize || 10));

    const [rows, total] = await Promise.all([
      LoginLogRepository.listByUserId(userId, { page: safePage, pageSize: safePageSize }),
      LoginLogRepository.countByUserId(userId),
    ]);

    return {
      list: LoginLogMapper.toRespList(rows),
      total,
      page: safePage,
      pageSize: safePageSize,
    };
  }
}
