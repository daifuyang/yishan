/**
 * 登录日志 Mapper
 */

import { sysLoginLog } from "@/db/schema";
import type { SysLoginLogResp } from "../schemas/login-log.js";
import { dateUtils } from "../../utils/date.js";

// ============================================================================
// Types
// ============================================================================

type SysLoginLogRow = typeof sysLoginLog.$inferSelect;

export type LoginLogListRow = Pick<
  SysLoginLogRow,
  "id" | "userId" | "username" | "realName" | "status" | "message" | "ipAddress" | "userAgent" | "createdAt" | "updatedAt"
>;

export type LoginLogDetailRow = LoginLogListRow;

// ============================================================================
// Mapper
// ============================================================================

export class LoginLogMapper {
  static toResp(row: LoginLogDetailRow): SysLoginLogResp {
    return {
      id: row.id,
      userId: row.userId ?? undefined,
      username: row.username,
      realName: row.realName ?? undefined,
      status: row.status.toString(),
      message: row.message ?? undefined,
      ipAddress: row.ipAddress ?? undefined,
      userAgent: row.userAgent ?? undefined,
      createdAt: dateUtils.formatISO(row.createdAt)!,
      updatedAt: dateUtils.formatISO(row.updatedAt)!,
    };
  }

  static toRespList(rows: LoginLogListRow[]): SysLoginLogResp[] {
    return rows.map((row) => this.toResp(row));
  }
}
