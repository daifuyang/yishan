import { prismaManager } from "../utils/prisma.js";
import type { Prisma } from "../generated/prisma/client.js";
import { TemplateListQuery, CreateTemplateReq, UpdateTemplateReq, PortalTemplateResp } from "../schemas/template.js";
import { dateUtils } from "../utils/date.js";

type TemplateWithRelations = Prisma.PortalTemplateGetPayload<{
  include: {
    creator: { select: { username: true } };
    updater: { select: { username: true } };
  };
}> & { creatorName?: string; updaterName?: string; isSystemDefault?: boolean };

const TYPE_MAP = {
  1: "article",
  2: "page",
} as const;

function typeToInt(type?: string): number | undefined {
  if (!type) return undefined;
  return type === "article" ? 1 : type === "page" ? 2 : undefined;
}

export class PortalTemplateModel {
  private static prisma = prismaManager.getClient();

  private static toResp(t: TemplateWithRelations): PortalTemplateResp {
    return {
      id: t.id,
      name: t.name,
      description: t.description ?? undefined,
      type: TYPE_MAP[t.type as 1 | 2] || "article",
      schema: (t.schema as any) ?? undefined,
      config: (t.config as any) ?? undefined,
      status: t.status.toString(),
      isSystemDefault: t.isSystemDefault ?? false,
      creatorId: t.creatorId ?? undefined,
      creatorName: t.creator?.username ?? t.creatorName,
      createdAt: dateUtils.formatISO(t.createdAt)!,
      updaterId: t.updaterId ?? undefined,
      updaterName: t.updater?.username ?? t.updaterName,
      updatedAt: dateUtils.formatISO(t.updatedAt)!,
    };
  }

  static async getTemplateList(query: TemplateListQuery): Promise<PortalTemplateResp[]> {
    const { page = 1, pageSize = 10, keyword, type, status, sortBy = "createdAt", sortOrder = "desc" } = query;
    const where: any = { deletedAt: null };
    if (keyword) where.OR = [{ name: { contains: keyword } }];
    const typeInt = typeToInt(type);
    if (typeInt !== undefined) where.type = typeInt;
    if (status !== undefined) where.status = parseInt(status as string, 10);
    const orderBy: any = {}; orderBy[sortBy] = sortOrder;

    const items = await this.prisma.portalTemplate.findMany({
      where,
      orderBy,
      skip: pageSize === 0 ? undefined : (page - 1) * pageSize,
      take: pageSize === 0 ? undefined : pageSize,
      include: { creator: { select: { username: true } }, updater: { select: { username: true } } },
    }) as unknown as TemplateWithRelations[];
    return items.map((t: TemplateWithRelations) => this.toResp(t));
  }

  static async getTemplateTotal(query: TemplateListQuery): Promise<number> {
    const { keyword, type, status } = query;
    const where: any = { deletedAt: null };
    if (keyword) where.OR = [{ name: { contains: keyword } }];
    const typeInt = typeToInt(type);
    if (typeInt !== undefined) where.type = typeInt;
    if (status !== undefined) where.status = parseInt(status as string, 10);
    return await this.prisma.portalTemplate.count({ where });
  }

  static async getTemplateById(id: number): Promise<PortalTemplateResp | null> {
    const t = await this.prisma.portalTemplate.findFirst({
      where: { id, deletedAt: null },
      include: { creator: { select: { username: true } }, updater: { select: { username: true } } },
    }) as unknown as TemplateWithRelations | null;
    if (!t) return null;
    return this.toResp(t);
  }

  static async getTemplateRawById(id: number) {
    return await this.prisma.portalTemplate.findFirst({ where: { id, deletedAt: null } });
  }

  static async getTemplateByNameAndType(name: string, type: "article" | "page") {
    return await this.prisma.portalTemplate.findFirst({ where: { name, type: type === "article" ? 1 : 2, deletedAt: null } });
  }

  static async createTemplate(req: CreateTemplateReq, userId: number): Promise<PortalTemplateResp> {
    const t = await this.prisma.portalTemplate.create({
      data: {
        name: req.name,
        description: req.description ?? null,
        type: req.type === "article" ? 1 : 2,
        schema: req.schema ? (req.schema as any) : undefined,
        config: req.config ? (req.config as any) : undefined,
        status: req.status ? parseInt(req.status, 10) : 1,
        isSystemDefault: (req as any).isSystemDefault ?? false,
        creatorId: userId,
        updaterId: userId,
      },
      include: { creator: { select: { username: true } }, updater: { select: { username: true } } },
    });
    return this.toResp(t as TemplateWithRelations);
  }

  static async updateTemplate(id: number, req: UpdateTemplateReq, userId?: number): Promise<PortalTemplateResp> {
    const data: any = {};
    if (req.name !== undefined) data.name = req.name;
    if (req.description !== undefined) data.description = req.description ?? null;
    if (req.type !== undefined) data.type = req.type === "article" ? 1 : 2;
    if (req.schema !== undefined) data.schema = req.schema as any;
    if (req.config !== undefined) data.config = req.config as any;
    if (req.status !== undefined) data.status = parseInt(req.status, 10);
    if (userId) data.updaterId = userId;

    const t = await this.prisma.portalTemplate.update({
      where: { id },
      data,
      include: { creator: { select: { username: true } }, updater: { select: { username: true } } },
    });
    return this.toResp(t as TemplateWithRelations);
  }

  static async deleteTemplate(id: number): Promise<{ id: number } | null> {
    const exists = await this.prisma.portalTemplate.findFirst({ where: { id, deletedAt: null } });
    if (!exists) return null;
    await this.prisma.portalTemplate.update({ where: { id }, data: { deletedAt: new Date(), status: 0 } });
    return { id };
  }

  static async getTemplateSchema(id: number): Promise<any[] | null> {
    const t = await this.prisma.portalTemplate.findFirst({ where: { id, deletedAt: null }, select: { schema: true } });
    if (!t) return null;
    return (t.schema as any) ?? [];
  }

  static async updateTemplateSchema(id: number, schema: any[], userId?: number): Promise<any[] | null> {
    const exists = await this.prisma.portalTemplate.findFirst({ where: { id, deletedAt: null } });
    if (!exists) return null;
    await this.prisma.portalTemplate.update({ where: { id }, data: { schema: schema as any, updaterId: userId } });
    const t = await this.prisma.portalTemplate.findFirst({ where: { id }, select: { schema: true } });
    return (t?.schema as any) ?? [];
  }
}
