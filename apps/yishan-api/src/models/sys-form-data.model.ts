import { prismaManager } from "../utils/prisma.js";
import type { Prisma } from "../generated/prisma/client.js";
import { CreateFormRecordReq, FormRecordListQuery, SysFormRecordResp, UpdateFormRecordReq } from "../schemas/form.js";
import { dateUtils } from "../utils/date.js";

type FormDataWithRelations = Prisma.SysFormDataGetPayload<{
  include: {
    creator: { select: { username: true } };
    updater: { select: { username: true } };
  };
}> & {
  creatorName?: string;
  updaterName?: string;
};

export class SysFormDataModel {
  private static prisma = prismaManager.getClient();

  private static mapToResp(record: FormDataWithRelations): SysFormRecordResp {
    return {
      id: record.id,
      resourceId: record.resourceId,
      data: record.data as Record<string, any>,
      status: record.status.toString(),
      creatorId: record.creatorId ?? undefined,
      creatorName: record.creator?.username ?? record.creatorName,
      createdAt: dateUtils.formatISO(record.createdAt)!,
      updaterId: record.updaterId ?? undefined,
      updaterName: record.updater?.username ?? record.updaterName,
      updatedAt: dateUtils.formatISO(record.updatedAt)!,
    };
  }

  static async getRecordList(resourceId: number, query: FormRecordListQuery): Promise<SysFormRecordResp[]> {
    const { page = 1, pageSize = 10, status, sortBy = "createdAt", sortOrder = "desc" } = query;
    const where: any = { deletedAt: null, resourceId };
    if (status !== undefined) where.status = parseInt(status as string, 10);
    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;
    const records = await this.prisma.sysFormData.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        creator: { select: { username: true } },
        updater: { select: { username: true } },
      },
    });
    return records.map((r) => this.mapToResp(r));
  }

  static async getRecordTotal(resourceId: number, query: FormRecordListQuery): Promise<number> {
    const { status } = query;
    const where: any = { deletedAt: null, resourceId };
    if (status !== undefined) where.status = parseInt(status as string, 10);
    return await this.prisma.sysFormData.count({ where });
  }

  static async getRecordById(resourceId: number, id: number): Promise<SysFormRecordResp | null> {
    const record = await this.prisma.sysFormData.findFirst({
      where: { id, resourceId, deletedAt: null },
      include: {
        creator: { select: { username: true } },
        updater: { select: { username: true } },
      },
    });
    if (!record) return null;
    return this.mapToResp(record);
  }

  static async createRecord(resourceId: number, req: CreateFormRecordReq, userId: number): Promise<SysFormRecordResp> {
    const record = await this.prisma.sysFormData.create({
      data: {
        resourceId,
        data: req.data,
        status: req.status ? parseInt(req.status, 10) : 1,
        creatorId: userId,
        updaterId: userId,
      },
      include: {
        creator: { select: { username: true } },
        updater: { select: { username: true } },
      },
    });
    return this.mapToResp(record);
  }

  static async updateRecord(resourceId: number, id: number, req: UpdateFormRecordReq, userId: number): Promise<SysFormRecordResp> {
    const updateData: any = { updaterId: userId };
    if (req.data !== undefined) updateData.data = req.data;
    if (req.status !== undefined) updateData.status = parseInt(req.status, 10);
    const record = await this.prisma.sysFormData.update({
      where: { id, resourceId, deletedAt: null },
      data: updateData,
      include: {
        creator: { select: { username: true } },
        updater: { select: { username: true } },
      },
    });
    return this.mapToResp(record);
  }

  static async deleteRecord(resourceId: number, id: number, userId: number): Promise<{ id: number } | null> {
    const existing = await this.prisma.sysFormData.findFirst({ where: { id, resourceId, deletedAt: null } });
    if (!existing) return null;
    await this.prisma.sysFormData.update({
      where: { id },
      data: { deletedAt: new Date(), status: 0, updaterId: userId },
    });
    return { id };
  }
}
