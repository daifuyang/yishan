import { prismaManager } from "../utils/prisma.js";
import type { Prisma } from "../generated/prisma/client.js";
import { CreateFormFieldReq, FormFieldListQuery, SysFormFieldResp, UpdateFormFieldReq } from "../schemas/form.js";
import { dateUtils } from "../utils/date.js";

type FormFieldWithRelations = Prisma.SysFormFieldGetPayload<{
  include: {
    creator: { select: { username: true } };
    updater: { select: { username: true } };
  };
}> & {
  creatorName?: string;
  updaterName?: string;
};

export class SysFormFieldModel {
  private static prisma = prismaManager.getClient();

  private static mapToResp(field: FormFieldWithRelations): SysFormFieldResp {
    return {
      id: field.id,
      resourceId: field.resourceId,
      key: field.key,
      label: field.label ?? undefined,
      type: field.type,
      required: !!field.required,
      status: field.status.toString(),
      sort_order: field.sort_order ?? 0,
      config: field.config ?? undefined,
      creatorId: field.creatorId ?? undefined,
      creatorName: field.creator?.username ?? field.creatorName,
      createdAt: dateUtils.formatISO(field.createdAt)!,
      updaterId: field.updaterId ?? undefined,
      updaterName: field.updater?.username ?? field.updaterName,
      updatedAt: dateUtils.formatISO(field.updatedAt)!,
    };
  }

  static async getFieldList(resourceId: number, query: FormFieldListQuery): Promise<SysFormFieldResp[]> {
    const { page = 1, pageSize = 10, keyword, status, sortBy = "sort_order", sortOrder = "asc" } = query;
    const where: any = { deletedAt: null, resourceId };
    if (keyword) {
      where.OR = [{ key: { contains: keyword } }, { label: { contains: keyword } }];
    }
    if (status !== undefined) where.status = parseInt(status as string, 10);
    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;
    const fields = await this.prisma.sysFormField.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        creator: { select: { username: true } },
        updater: { select: { username: true } },
      },
    });
    return fields.map((f) => this.mapToResp(f));
  }

  static async getFieldTotal(resourceId: number, query: FormFieldListQuery): Promise<number> {
    const { keyword, status } = query;
    const where: any = { deletedAt: null, resourceId };
    if (keyword) {
      where.OR = [{ key: { contains: keyword } }, { label: { contains: keyword } }];
    }
    if (status !== undefined) where.status = parseInt(status as string, 10);
    return await this.prisma.sysFormField.count({ where });
  }

  static async getFieldById(resourceId: number, id: number): Promise<SysFormFieldResp | null> {
    const field = await this.prisma.sysFormField.findFirst({
      where: { id, resourceId, deletedAt: null },
      include: {
        creator: { select: { username: true } },
        updater: { select: { username: true } },
      },
    });
    if (!field) return null;
    return this.mapToResp(field);
  }

  static async getFieldByKey(resourceId: number, key: string) {
    return await this.prisma.sysFormField.findFirst({
      where: { resourceId, key, deletedAt: null },
    });
  }

  static async createField(resourceId: number, req: CreateFormFieldReq, userId: number): Promise<SysFormFieldResp> {
    const field = await this.prisma.sysFormField.create({
      data: {
        resourceId,
        key: req.key,
        label: req.label,
        type: req.type,
        required: req.required ?? false,
        status: req.status ? parseInt(req.status, 10) : 1,
        sort_order: req.sort_order ?? 0,
        config: req.config ?? undefined,
        creatorId: userId,
        updaterId: userId,
      },
      include: {
        creator: { select: { username: true } },
        updater: { select: { username: true } },
      },
    });
    return this.mapToResp(field);
  }

  static async updateField(resourceId: number, id: number, req: UpdateFormFieldReq, userId: number): Promise<SysFormFieldResp> {
    const updateData: any = { updaterId: userId };
    if (req.key !== undefined) updateData.key = req.key;
    if (req.label !== undefined) updateData.label = req.label;
    if (req.type !== undefined) updateData.type = req.type;
    if (req.required !== undefined) updateData.required = req.required;
    if (req.status !== undefined) updateData.status = parseInt(req.status, 10);
    if (req.sort_order !== undefined) updateData.sort_order = req.sort_order;
    if (req.config !== undefined) updateData.config = req.config;
    const field = await this.prisma.sysFormField.update({
      where: { id, resourceId, deletedAt: null },
      data: updateData,
      include: {
        creator: { select: { username: true } },
        updater: { select: { username: true } },
      },
    });
    return this.mapToResp(field);
  }

  static async deleteField(resourceId: number, id: number, userId: number): Promise<{ id: number } | null> {
    const existing = await this.prisma.sysFormField.findFirst({ where: { id, resourceId, deletedAt: null } });
    if (!existing) return null;
    await this.prisma.sysFormField.update({
      where: { id },
      data: { deletedAt: new Date(), status: 0, updaterId: userId },
    });
    return { id };
  }
}
