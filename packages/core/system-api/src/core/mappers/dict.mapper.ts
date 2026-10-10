/**
 * 字典实体到 API 响应 DTO 的映射器
 */

import { dateUtils } from "../../utils/date.js";
import type { SysDictTypeResp, SysDictDataResp } from "../schemas/dict.js";

// 类型定义 - 这些类型来自 DictRepository 的返回值
type DictTypeListRow = {
  id: number;
  name: string;
  type: string;
  status: number;
  sortOrder: number | null;
  remark: string | null;
  creatorId: number | null;
  createdAt: Date;
  updaterId: number | null;
  updatedAt: Date;
  creatorName: string | null;
  updaterName: string | null;
};

type DictTypeDetailRow = DictTypeListRow;

type DictDataListRow = {
  id: number;
  typeId: number;
  label: string;
  value: string;
  status: number;
  sortOrder: number | null;
  tag: string | null;
  remark: string | null;
  isDefault: boolean;
  creatorId: number | null;
  createdAt: Date;
  updaterId: number | null;
  updatedAt: Date;
  typeType: string | null;
  creatorName: string | null;
  updaterName: string | null;
};

type DictDataDetailRow = DictDataListRow;

export class DictMapper {
  static toDictTypeListResp(dictType: DictTypeListRow): SysDictTypeResp {
    return {
      id: dictType.id,
      name: dictType.name,
      type: dictType.type,
      status: dictType.status,
      sort_order: dictType.sortOrder ?? 0,
      remark: dictType.remark ?? undefined,
      creatorId: dictType.creatorId ?? undefined,
      creatorName: dictType.creatorName ?? undefined,
      createdAt: dateUtils.formatISO(dictType.createdAt)!,
      updaterId: dictType.updaterId ?? undefined,
      updaterName: dictType.updaterName ?? undefined,
      updatedAt: dateUtils.formatISO(dictType.updatedAt)!,
    };
  }

  static toDictTypeDetailResp(dictType: DictTypeDetailRow): SysDictTypeResp {
    return this.toDictTypeListResp(dictType);
  }

  static toDictDataListResp(dictData: DictDataListRow): SysDictDataResp {
    return {
      id: dictData.id,
      typeId: dictData.typeId,
      type: dictData.typeType ?? '',
      label: dictData.label,
      value: dictData.value,
      status: dictData.status,
      sort_order: dictData.sortOrder ?? 0,
      tag: dictData.tag ?? undefined,
      remark: dictData.remark ?? undefined,
      isDefault: !!dictData.isDefault,
      creatorId: dictData.creatorId ?? undefined,
      creatorName: dictData.creatorName ?? undefined,
      createdAt: dateUtils.formatISO(dictData.createdAt)!,
      updaterId: dictData.updaterId ?? undefined,
      updaterName: dictData.updaterName ?? undefined,
      updatedAt: dateUtils.formatISO(dictData.updatedAt)!,
    };
  }

  static toDictDataDetailResp(dictData: DictDataDetailRow): SysDictDataResp {
    return this.toDictDataListResp(dictData);
  }
}
