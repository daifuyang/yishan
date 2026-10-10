/**
 * 岗位 DTO 映射器
 */

import { dateUtils } from "../../utils/date.js";
import type { SysPositionResp } from "../schemas/position.js";
import type { PositionRow } from "../repositories/position.repository.js";

export class SysPositionMapper {
  static toResp(p: PositionRow): SysPositionResp {
    return {
      id: p.id,
      name: p.name,
      status: p.status.toString(),
      sort_order: p.sortOrder ?? 0,
      description: p.description ?? undefined,
      creatorId: p.creatorId ?? undefined,
      creatorName: p.creatorName ?? undefined,
      createdAt: dateUtils.formatISO(p.createdAt) ?? "",
      updaterId: p.updaterId ?? undefined,
      updaterName: p.updaterName ?? undefined,
      updatedAt: dateUtils.formatISO(p.updatedAt) ?? "",
    };
  }
}
