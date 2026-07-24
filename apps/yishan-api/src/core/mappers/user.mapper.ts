/**
 * 用户实体到 API 响应 DTO 的映射器
 */

import { dateUtils } from "../../utils/date.js";
import { getUserStatusLabel, type UserStatus } from "../constants/user-status.js";
import type { SysUserResp } from "../schemas/user.js";
import type { UserListRowWithRelations, UserDetailRow } from "../repositories/user.repository.js";

const genderMap = { 0: "未知", 1: "男", 2: "女" };

export class UserMapper {
  static toListResp(user: UserListRowWithRelations): SysUserResp {
    return {
      id: user.id,
      username: user.username ?? undefined,
      email: user.email ?? undefined,
      phone: (user.phone ?? "") as string,
      realName: user.realName ?? undefined,
      nickname: user.nickname ?? undefined,
      avatar: user.avatar ?? undefined,
      gender: user.gender.toString(),
      genderName: genderMap[user.gender as keyof typeof genderMap] || "未知",
      birthDate: dateUtils.formatDate(user.birthDate) ?? undefined,
      status: user.status as UserStatus,
      statusName: getUserStatusLabel(user.status as UserStatus),
      lastLoginTime: dateUtils.formatISO(user.lastLoginTime) ?? undefined,
      lastLoginIp: user.lastLoginIp ?? undefined,
      loginCount: user.loginCount,
      creatorId: (user.creatorId ?? 0) as number,
      creatorName: user.creator?.username ?? undefined,
      createdAt: dateUtils.formatISO(user.createdAt)!,
      updaterId: (user.updaterId ?? 0) as number,
      updaterName: user.updater?.username ?? undefined,
      updatedAt: dateUtils.formatISO(user.updatedAt)!,
      deptIds: undefined,
      roleIds: undefined,
    };
  }

  static toDetailResp(user: UserDetailRow): SysUserResp {
    return {
      id: user.id,
      username: user.username ?? undefined,
      email: user.email ?? undefined,
      phone: (user.phone ?? "") as string,
      realName: user.realName ?? undefined,
      nickname: user.nickname ?? undefined,
      avatar: user.avatar ?? undefined,
      gender: user.gender.toString(),
      genderName: genderMap[user.gender as keyof typeof genderMap] || "未知",
      birthDate: dateUtils.formatDate(user.birthDate) ?? undefined,
      status: user.status as UserStatus,
      statusName: getUserStatusLabel(user.status as UserStatus),
      lastLoginTime: dateUtils.formatISO(user.lastLoginTime) ?? undefined,
      lastLoginIp: user.lastLoginIp ?? undefined,
      loginCount: user.loginCount,
      creatorId: (user.creatorId ?? 0) as number,
      creatorName: user.creatorName ?? undefined,
      createdAt: dateUtils.formatISO(user.createdAt)!,
      updaterId: (user.updaterId ?? 0) as number,
      updaterName: user.updaterName ?? undefined,
      updatedAt: dateUtils.formatISO(user.updatedAt)!,
      deptIds: user.deptIds,
      roleIds: user.roleIds,
    };
  }
}
