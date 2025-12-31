import { prismaManager } from "../utils/prisma.js";
import { dateUtils } from "../utils/date.js";
import { SysLoginLogListQuery, SysLoginLogResp } from "../schemas/login-log.js";

export interface CreateLoginLogData {
  userId?: number | null;
  username: string;
  realName?: string | null;
  status: 0 | 1;
  message?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export class SysLoginLogModel {
  private static prisma = prismaManager.getClient();

  private static mapToResp(item: any): SysLoginLogResp {
    return {
      id: item.id,
      userId: item.userId ?? undefined,
      username: item.username,
      realName: item.realName ?? undefined,
      status: item.status.toString(),
      message: item.message ?? undefined,
      ipAddress: item.ipAddress ?? undefined,
      userAgent: item.userAgent ?? undefined,
      createdAt: dateUtils.formatISO(item.createdAt)!,
      updatedAt: dateUtils.formatISO(item.updatedAt)!,
    };
  }

  static async create(data: CreateLoginLogData) {
    return await this.prisma.sysLoginLog.create({
      data: {
        userId: data.userId ?? null,
        username: data.username,
        realName: data.realName ?? null,
        status: data.status,
        message: data.message ?? null,
        ipAddress: data.ipAddress ?? null,
        userAgent: data.userAgent ?? null,
      },
    });
  }

  static async getById(id: number): Promise<SysLoginLogResp | null> {
    const item = await this.prisma.sysLoginLog.findFirst({
      where: { id, deletedAt: null },
    });
    if (!item) return null;
    return this.mapToResp(item);
  }

  static async getList(query: SysLoginLogListQuery): Promise<SysLoginLogResp[]> {
    const {
      page = 1,
      pageSize = 10,
      keyword,
      status,
      startTime,
      endTime,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = query;

    const where: any = { deletedAt: null };

    if (keyword) {
      where.OR = [
        { username: { contains: keyword } },
        { realName: { contains: keyword } },
        { ipAddress: { contains: keyword } },
        { message: { contains: keyword } },
      ];
    }

    if (status !== undefined) {
      where.status = parseInt(status as string, 10);
    }

    if (startTime) {
      where.createdAt = where.createdAt || {};
      where.createdAt.gte = new Date(startTime);
    }
    if (endTime) {
      where.createdAt = where.createdAt || {};
      where.createdAt.lte = new Date(endTime);
    }

    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;

    const list = await this.prisma.sysLoginLog.findMany({
      where,
      orderBy,
      skip: pageSize === 0 ? undefined : (page - 1) * pageSize,
      take: pageSize === 0 ? undefined : pageSize,
    });

    return list.map((item) => this.mapToResp(item));
  }

  static async getTotal(query: SysLoginLogListQuery): Promise<number> {
    const { keyword, status, startTime, endTime } = query;

    const where: any = { deletedAt: null };

    if (keyword) {
      where.OR = [
        { username: { contains: keyword } },
        { realName: { contains: keyword } },
        { ipAddress: { contains: keyword } },
        { message: { contains: keyword } },
      ];
    }

    if (status !== undefined) {
      where.status = parseInt(status as string, 10);
    }

    if (startTime) {
      where.createdAt = where.createdAt || {};
      where.createdAt.gte = new Date(startTime);
    }
    if (endTime) {
      where.createdAt = where.createdAt || {};
      where.createdAt.lte = new Date(endTime);
    }

    return await this.prisma.sysLoginLog.count({ where });
  }
}

