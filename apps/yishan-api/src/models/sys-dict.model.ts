import { prismaManager } from "../utils/prisma.js";
import type { Prisma } from "../generated/prisma/client.js";
import { dateUtils } from "../utils/date.js";
import {
  DictDataListQuery,
  DictTypeListQuery,
  SaveDictDataReq,
  SaveDictTypeReq,
  SysDictDataResp,
  SysDictTypeResp,
  UpdateDictDataReq,
  UpdateDictTypeReq,
} from "../schemas/dict.js";

type DictTypeWithRelations = Prisma.SysDictTypeGetPayload<{
  include: {
    creator: { select: { username: true } };
    updater: { select: { username: true } };
  };
}> & { creatorName?: string; updaterName?: string };

type DictDataWithRelations = Prisma.SysDictDataGetPayload<{
  include: {
    type: { select: { type: true } };
    creator: { select: { username: true } };
    updater: { select: { username: true } };
  };
}> & { creatorName?: string; updaterName?: string };

export class SysDictModel {
  private static prisma = prismaManager.getClient();

  private static mapType(d: DictTypeWithRelations): SysDictTypeResp {
    return {
      id: d.id,
      name: d.name,
      type: d.type,
      status: d.status,
      sort_order: d.sort_order ?? 0,
      remark: d.remark ?? undefined,
      creatorId: d.creatorId ?? undefined,
      creatorName: d.creator?.username ?? d.creatorName,
      createdAt: dateUtils.formatISO(d.createdAt)!,
      updaterId: d.updaterId ?? undefined,
      updaterName: d.updater?.username ?? d.updaterName,
      updatedAt: dateUtils.formatISO(d.updatedAt)!,
    };
  }

  private static mapData(d: DictDataWithRelations): SysDictDataResp {
    return {
      id: d.id,
      typeId: d.typeId,
      type: d.type.type,
      label: d.label,
      value: d.value,
      status: d.status,
      sort_order: d.sort_order ?? 0,
      tag: d.tag ?? undefined,
      remark: d.remark ?? undefined,
      isDefault: !!d.isDefault,
      creatorId: d.creatorId ?? undefined,
      creatorName: d.creator?.username ?? d.creatorName,
      createdAt: dateUtils.formatISO(d.createdAt)!,
      updaterId: d.updaterId ?? undefined,
      updaterName: d.updater?.username ?? d.updaterName,
      updatedAt: dateUtils.formatISO(d.updatedAt)!,
    };
  }

  static async getDictTypeList(query: DictTypeListQuery): Promise<SysDictTypeResp[]> {
    const { page = 1, pageSize = 10, keyword, status, sortBy = "sort_order", sortOrder = "asc" } = query;
    const where: any = { deletedAt: null };
    if (keyword) {
      where.OR = [
        { name: { contains: keyword } },
        { type: { contains: keyword } },
        { remark: { contains: keyword } },
      ];
    }
    if (status !== undefined) where.status = status;
    const orderBy: any = {}; orderBy[sortBy] = sortOrder;
    const rows = await this.prisma.sysDictType.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        creator: { select: { username: true } },
        updater: { select: { username: true } },
      },
    });
    return rows.map((r) => this.mapType(r));
  }

  static async getDictTypeTotal(query: DictTypeListQuery): Promise<number> {
    const { keyword, status } = query;
    const where: any = { deletedAt: null };
    if (keyword) {
      where.OR = [
        { name: { contains: keyword } },
        { type: { contains: keyword } },
        { remark: { contains: keyword } },
      ];
    }
    if (status !== undefined) where.status = status;
    return await this.prisma.sysDictType.count({ where });
  }

  static async getDictTypeById(id: number): Promise<SysDictTypeResp | null> {
    const d = await this.prisma.sysDictType.findFirst({
      where: { id, deletedAt: null },
      include: {
        creator: { select: { username: true } },
        updater: { select: { username: true } },
      },
    });
    if (!d) return null;
    return this.mapType(d);
  }

  static async getDictTypeByType(type: string) {
    return await this.prisma.sysDictType.findFirst({ where: { type, deletedAt: null } });
  }

  static async createDictType(req: SaveDictTypeReq): Promise<SysDictTypeResp> {
    const d = await this.prisma.sysDictType.create({
      data: {
        name: req.name,
        type: req.type,
        status: req.status ?? 1,
        sort_order: req.sort_order ?? 0,
        remark: req.remark,
        creatorId: 1,
        updaterId: 1,
      },
      include: {
        creator: { select: { username: true } },
        updater: { select: { username: true } },
      },
    });
    return this.mapType(d);
  }

  static async updateDictType(id: number, req: UpdateDictTypeReq): Promise<SysDictTypeResp> {
    const data: any = {};
    if (req.name !== undefined) data.name = req.name;
    if (req.type !== undefined) data.type = req.type;
    if (req.status !== undefined) data.status = req.status;
    if (req.sort_order !== undefined) data.sort_order = req.sort_order;
    if (req.remark !== undefined) data.remark = req.remark;
    const d = await this.prisma.sysDictType.update({
      where: { id, deletedAt: null },
      data,
      include: {
        creator: { select: { username: true } },
        updater: { select: { username: true } },
      },
    });
    return this.mapType(d);
  }

  static async deleteDictType(id: number): Promise<{ id: number } | null> {
    const existing = await this.prisma.sysDictType.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return null;
    const count = await this.prisma.sysDictData.count({ where: { typeId: id, deletedAt: null } });
    if (count > 0) return null;
    await this.prisma.sysDictType.update({ where: { id }, data: { deletedAt: new Date(), status: 0 } });
    return { id };
  }

  static async getDictDataList(query: DictDataListQuery): Promise<SysDictDataResp[]> {
    const { page = 1, pageSize = 10, typeId, type, keyword, status, sortBy = "sort_order", sortOrder = "asc" } = query;
    const where: any = { deletedAt: null };
    if (typeId !== undefined) where.typeId = typeId;
    if (keyword) {
      where.OR = [
        { label: { contains: keyword } },
        { value: { contains: keyword } },
        { tag: { contains: keyword } },
        { remark: { contains: keyword } },
      ];
    }
    if (status !== undefined) where.status = status;

    let typeFilter: number | undefined;
    if (type && !typeId) {
      const t = await this.prisma.sysDictType.findFirst({ where: { type, deletedAt: null }, select: { id: true } });
      typeFilter = t?.id;
      if (typeFilter) where.typeId = typeFilter;
    }

    const orderBy: any = {}; orderBy[sortBy] = sortOrder;
    const rows = await this.prisma.sysDictData.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        type: { select: { type: true } },
        creator: { select: { username: true } },
        updater: { select: { username: true } },
      },
    });
    return rows.map((r) => this.mapData(r));
  }

  static async getDictDataTotal(query: DictDataListQuery): Promise<number> {
    const { typeId, type, keyword, status } = query;
    const where: any = { deletedAt: null };
    if (typeId !== undefined) where.typeId = typeId;
    if (keyword) {
      where.OR = [
        { label: { contains: keyword } },
        { value: { contains: keyword } },
        { tag: { contains: keyword } },
        { remark: { contains: keyword } },
      ];
    }
    if (status !== undefined) where.status = status;
    if (type && !typeId) {
      const t = await this.prisma.sysDictType.findFirst({ where: { type, deletedAt: null }, select: { id: true } });
      if (t?.id) where.typeId = t.id;
    }
    return await this.prisma.sysDictData.count({ where });
  }

  static async getDictDataById(id: number): Promise<SysDictDataResp | null> {
    const d = await this.prisma.sysDictData.findFirst({
      where: { id, deletedAt: null },
      include: {
        type: { select: { type: true } },
        creator: { select: { username: true } },
        updater: { select: { username: true } },
      },
    });
    if (!d) return null;
    return this.mapData(d);
  }

  static async getDictDataByTypeAndValue(typeId: number, value: string) {
    return await this.prisma.sysDictData.findFirst({
      where: { typeId, value, deletedAt: null },
    });
  }

  static async createDictData(req: SaveDictDataReq): Promise<SysDictDataResp> {
    const d = await this.prisma.sysDictData.create({
      data: {
        typeId: req.typeId,
        label: req.label,
        value: req.value,
        status: req.status ?? 1,
        sort_order: req.sort_order ?? 0,
        tag: req.tag,
        remark: req.remark,
        isDefault: req.isDefault ?? false,
        creatorId: 1,
        updaterId: 1,
      },
      include: {
        type: { select: { type: true } },
        creator: { select: { username: true } },
        updater: { select: { username: true } },
      },
    });
    return this.mapData(d);
  }

  static async updateDictData(id: number, req: UpdateDictDataReq): Promise<SysDictDataResp> {
    const data: any = {};
    if (req.typeId !== undefined) data.typeId = req.typeId;
    if (req.label !== undefined) data.label = req.label;
    if (req.value !== undefined) data.value = req.value;
    if (req.status !== undefined) data.status = req.status;
    if (req.sort_order !== undefined) data.sort_order = req.sort_order;
    if (req.tag !== undefined) data.tag = req.tag;
    if (req.remark !== undefined) data.remark = req.remark;
    if (req.isDefault !== undefined) data.isDefault = req.isDefault;
    const d = await this.prisma.sysDictData.update({
      where: { id, deletedAt: null },
      data,
      include: {
        type: { select: { type: true } },
        creator: { select: { username: true } },
        updater: { select: { username: true } },
      },
    });
    return this.mapData(d);
  }

  static async deleteDictData(id: number): Promise<{ id: number } | null> {
    const existing = await this.prisma.sysDictData.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return null;
    await this.prisma.sysDictData.update({ where: { id }, data: { deletedAt: new Date(), status: 0 } });
    return { id };
  }

  static async getAllDictDataMap(): Promise<Record<string, { label: string; value: string }[]>> {
    const rows = await this.prisma.sysDictData.findMany({
      where: { deletedAt: null, status: 1 },
      include: {
        type: { select: { type: true } },
      },
      orderBy: {
        sort_order: 'asc',
      },
    });

    const result: Record<string, { label: string; value: string }[]> = {};
    
    rows.forEach((row) => {
      const type = row.type.type;
      if (!result[type]) {
        result[type] = [];
      }
      result[type].push({
        label: row.label,
        value: row.value,
      });
    });

    return result;
  }
}