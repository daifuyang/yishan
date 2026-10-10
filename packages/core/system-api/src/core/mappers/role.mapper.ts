/**
 * 角色实体到 API 响应 DTO 的映射器
 */

import { dateUtils } from "../../utils/date.js";
import type { SysRoleResp } from "../schemas/role.js";

// 类型定义 - 这些类型来自 RoleRepository 的返回值
type RoleListRow = {
  id: number;
  name: string;
  description: string | null;
  status: number;
  dataScope: number;
  isSystemDefault: boolean;
  creatorId: number | null;
  createdAt: Date;
  updaterId: number | null;
  updatedAt: Date;
  creatorName: string | null;
  updaterName: string | null;
};

type RoleDetailRow = RoleListRow & {
  menuIds: number[];
  permissionCodes: string[];
};

export class RoleMapper {
  static toListResp(role: RoleListRow): SysRoleResp {
    return {
      id: role.id,
      name: role.name,
      description: role.description ?? undefined,
      status: role.status.toString(),
      dataScope: role.dataScope.toString(),
      isSystemDefault: role.isSystemDefault ?? false,
      creatorId: role.creatorId ?? undefined,
      creatorName: role.creatorName ?? undefined,
      createdAt: dateUtils.formatISO(role.createdAt)!,
      updaterId: role.updaterId ?? undefined,
      updaterName: role.updaterName ?? undefined,
      updatedAt: dateUtils.formatISO(role.updatedAt)!,
      menuIds: undefined,
      permissionCodes: undefined,
    };
  }

  static toDetailResp(role: RoleDetailRow): SysRoleResp {
    return {
      id: role.id,
      name: role.name,
      description: role.description ?? undefined,
      status: role.status.toString(),
      dataScope: role.dataScope.toString(),
      isSystemDefault: role.isSystemDefault ?? false,
      creatorId: role.creatorId ?? undefined,
      creatorName: role.creatorName ?? undefined,
      createdAt: dateUtils.formatISO(role.createdAt)!,
      updaterId: role.updaterId ?? undefined,
      updaterName: role.updaterName ?? undefined,
      updatedAt: dateUtils.formatISO(role.updatedAt)!,
      menuIds: role.menuIds,
      permissionCodes: role.permissionCodes,
    };
  }
}
