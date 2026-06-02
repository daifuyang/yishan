/**
 * 商品属性数据访问模型
 */

import { prismaManager } from '@/utils/prisma.js'
import { dateUtils } from '../utils/date.js'

export interface AttributeListQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  type?: number;
  status?: string;
}

export interface AttributeValueResp {
  id: number;
  attributeId: number;
  value: string;
  image: string | null;
  sortOrder: number;
  status: string;
  creatorId: number;
  createdAt: string;
}

export interface AttributeResp {
  id: number;
  name: string;
  type: number;
  typeName: string;
  sortOrder: number;
  status: string;
  statusName: string;
  creatorId: number;
  creatorName: string | null;
  createdAt: string;
  updaterId: number;
  updaterName: string | null;
  updatedAt: string;
  values: AttributeValueResp[];
}

const typeMap: Record<number, string> = {
  1: "普通属性",
  2: "规格属性",
};

const statusMap: Record<number, string> = {
  0: "禁用",
  1: "启用",
};

export class ShopAttributeModel {
  private static prisma = prismaManager.getClient();

  private static mapToResp(attr: any): AttributeResp {
    return {
      id: attr.id,
      name: attr.name,
      type: attr.type,
      typeName: typeMap[attr.type] || "未知",
      sortOrder: attr.sortOrder,
      status: attr.status.toString(),
      statusName: statusMap[attr.status] || "未知",
      creatorId: attr.creatorId,
      creatorName: null,
      createdAt: dateUtils.formatISO(attr.createdAt)!,
      updaterId: attr.updaterId,
      updaterName: null,
      updatedAt: dateUtils.formatISO(attr.updatedAt)!,
      values: attr.values?.map((v: any) => ({
        id: v.id,
        attributeId: v.attributeId,
        value: v.value,
        image: v.image ?? null,
        sortOrder: v.sortOrder,
        status: v.status.toString(),
        creatorId: v.creatorId,
        createdAt: dateUtils.formatISO(v.createdAt)!,
      })) || [],
    };
  }

  static async getAttributeList(query: AttributeListQuery): Promise<{ list: AttributeResp[]; total: number }> {
    const { page = 1, pageSize = 10, keyword, type, status } = query;

    const where: any = {
      deletedAt: null,
    };

    if (type !== undefined) {
      where.type = type;
    }

    if (status) {
      where.status = parseInt(status);
    }

    if (keyword) {
      where.OR = [{ name: { contains: keyword } }];
    }

    const [attributes, total] = await Promise.all([
      this.prisma.shopAttribute.findMany({
        where,
        orderBy: { sortOrder: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          values: {
            where: { deletedAt: null },
            orderBy: { sortOrder: "asc" },
          },
        },
      }),
      this.prisma.shopAttribute.count({ where }),
    ]);

    return {
      list: attributes.map((a: any) => this.mapToResp(a)),
      total,
    };
  }

  static async getAttributeById(id: number): Promise<AttributeResp | null> {
    const attr = await this.prisma.shopAttribute.findUnique({
      where: { id, deletedAt: null },
      include: {
        values: {
          where: { deletedAt: null },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!attr) return null;
    return this.mapToResp(attr);
  }

  static async getSpecAttributes(): Promise<AttributeResp[]> {
    const attributes = await this.prisma.shopAttribute.findMany({
      where: { deletedAt: null, type: 2, status: 1 },
      orderBy: { sortOrder: "asc" },
      include: {
        values: {
          where: { deletedAt: null, status: 1 },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    return attributes.map((a: any) => this.mapToResp(a));
  }

  static async createAttribute(data: any, creatorId: number): Promise<AttributeResp> {
    const attribute = await this.prisma.shopAttribute.create({
      data: {
        name: data.name,
        type: data.type ?? 1,
        sortOrder: data.sortOrder ?? 0,
        status: data.status ?? 1,
        creatorId,
        updaterId: creatorId,
        values: data.values ? {
          create: data.values.map((v: any) => ({
            value: v.value,
            image: v.image,
            sortOrder: v.sortOrder ?? 0,
            status: 1,
            creatorId,
            updaterId: creatorId,
          })),
        } : undefined,
      },
      include: {
        values: {
          where: { deletedAt: null },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    return this.mapToResp(attribute);
  }

  static async updateAttribute(id: number, data: any, updaterId: number): Promise<AttributeResp> {
    const attribute = await this.prisma.shopAttribute.update({
      where: { id },
      data: {
        ...data,
        updaterId,
      },
      include: {
        values: {
          where: { deletedAt: null },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    return this.mapToResp(attribute);
  }

  static async deleteAttribute(id: number): Promise<boolean> {
    await this.prisma.shopAttribute.update({
      where: { id },
      data: { deletedAt: dateUtils.now() },
    });
    return true;
  }

  static async createAttributeValue(attributeId: number, data: any, creatorId: number): Promise<AttributeValueResp> {
    const value = await this.prisma.shopAttributeValue.create({
      data: {
        attributeId,
        value: data.value,
        image: data.image,
        sortOrder: data.sortOrder ?? 0,
        status: 1,
        creatorId,
        updaterId: creatorId,
      },
    });

    return {
      id: value.id,
      attributeId: value.attributeId,
      value: value.value,
      image: value.image ?? null,
      sortOrder: value.sortOrder,
      status: value.status.toString(),
      creatorId: value.creatorId,
      createdAt: dateUtils.formatISO(value.createdAt)!,
    };
  }

  static async updateAttributeValue(id: number, data: any, updaterId: number): Promise<AttributeValueResp> {
    const value = await this.prisma.shopAttributeValue.update({
      where: { id },
      data: { ...data, updaterId },
    });

    return {
      id: value.id,
      attributeId: value.attributeId,
      value: value.value,
      image: value.image ?? null,
      sortOrder: value.sortOrder,
      status: value.status.toString(),
      creatorId: value.creatorId,
      createdAt: dateUtils.formatISO(value.createdAt)!,
    };
  }

  static async deleteAttributeValue(id: number): Promise<boolean> {
    await this.prisma.shopAttributeValue.update({
      where: { id },
      data: { deletedAt: dateUtils.now() },
    });
    return true;
  }
}
