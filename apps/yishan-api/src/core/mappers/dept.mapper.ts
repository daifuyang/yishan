/**
 * 部门实体到 API 响应 DTO 的映射器
 */

import { dateUtils } from "../../utils/date.js";
import type { SysDeptResp } from "../schemas/department.js";

// 类型定义 - 这些类型来自 DeptRepository 的返回值
type DeptFlatRow = {
  id: number;
  name: string;
  parentId: number | null;
  status: number;
  sortOrder: number | null;
  description: string | null;
  leaderId: number | null;
  creatorId: number | null;
  createdAt: Date;
  updaterId: number | null;
  updatedAt: Date;
  parentName: string | null;
  leaderName: string | null;
  creatorName: string | null;
  updaterName: string | null;
};

export class DeptMapper {
  static toResp(dept: DeptFlatRow): SysDeptResp {
    return {
      id: dept.id,
      name: dept.name,
      parentId: dept.parentId ?? 0,
      parentName: dept.parentName ?? undefined,
      status: dept.status.toString(),
      sort_order: dept.sortOrder ?? 0,
      description: dept.description ?? undefined,
      leaderId: dept.leaderId ?? undefined,
      leaderName: dept.leaderName ?? undefined,
      creatorId: dept.creatorId ?? undefined,
      creatorName: dept.creatorName ?? undefined,
      createdAt: dateUtils.formatISO(dept.createdAt)!,
      updaterId: dept.updaterId ?? undefined,
      updaterName: dept.updaterName ?? undefined,
      updatedAt: dateUtils.formatISO(dept.updatedAt)!,
    };
  }
}
