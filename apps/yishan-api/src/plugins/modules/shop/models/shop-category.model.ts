/**
 * 商品分类数据访问模型
 */

import { prismaManager } from '@/utils/prisma.js'
import { dateUtils } from '../utils/date.js'

type CategoryWithRelations = any;

export interface CategoryListQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  parentId?: number;
  status?: string;
  sortBy?: "sortOrder" | "createdAt" | "updatedAt";
  sortOrder?: "asc" | "desc";
}

export interface CategoryResp {
  id: number;
  name: string;
  parentId: number | null;
  parentName: string | null;
  coverImage: string | null;
  icon: string | null;
  description: string | null;
  sortOrder: number;
  status: string;
  statusName: string;
  creatorId: number;
  creatorName: string | null;
  createdAt: string;
  updaterId: number;
  updaterName: string | null;
  updatedAt: string;
  children: CategoryResp[] | null;
}

const statusMap: Record<number, string> = {
  0: "禁用",
  1: "启用",
};

export class ShopCategoryModel {
  private static prisma = prismaManager.getClient();

  private static mapToResp(category: CategoryWithRelations, includeChildren = false): CategoryResp {
    const base: CategoryResp = {
      id: category.id,
      name: category.name,
      parentId: category.parentId,
      parentName: null,
      coverImage: category.coverImage ?? null,
      icon: category.icon ?? null,
      description: category.description ?? null,
      sortOrder: category.sortOrder,
      status: category.status.toString(),
      statusName: statusMap[category.status] || "未知",
      creatorId: category.creatorId,
      creatorName: null,
      createdAt: dateUtils.formatISO(category.createdAt)!,
      updaterId: category.updaterId,
      updaterName: null,
      updatedAt: dateUtils.formatISO(category.updatedAt)!,
      children: null,
    };

    if (includeChildren && category.children && category.children.length > 0) {
      base.children = category.children.map((child: CategoryWithRelations) =>
        this.mapToResp(child, true)
      );
    }

    return base;
  }

  static async getCategoryList(query: CategoryListQuery): Promise<CategoryResp[]> {
    const { parentId, status, keyword } = query;

    const where: any = {
      deletedAt: null,
    };

    if (parentId !== undefined) {
      where.parentId = parentId === 0 ? null : parentId;
    }

    if (status) {
      where.status = parseInt(status);
    }

    if (keyword) {
      where.OR = [
        { name: { contains: keyword } },
        { description: { contains: keyword } },
      ];
    }

    const orderBy: any = {};
    if (query.sortBy) {
      orderBy[query.sortBy === 'sortOrder' ? 'sortOrder' : query.sortBy] = query.sortOrder === "asc" ? "asc" : "desc";
    } else {
      orderBy.sortOrder = "asc";
    }

    const categories = await this.prisma.shopCategory.findMany({
      where,
      orderBy,
    });

    return categories.map((c: CategoryWithRelations) => this.mapToResp(c, false));
  }

  static async getCategoryTree(): Promise<CategoryResp[]> {
    const categories = await this.prisma.shopCategory.findMany({
      where: { deletedAt: null, parentId: null },
      orderBy: { sortOrder: "asc" },
      include: {
        children: {
          where: { deletedAt: null },
          orderBy: { sortOrder: "asc" },
          include: {
            children: {
              where: { deletedAt: null },
              orderBy: { sortOrder: "asc" },
            },
          },
        },
      },
    });

    return categories.map((c: CategoryWithRelations) => this.mapToResp(c, true));
  }

  static async getCategoryById(id: number): Promise<CategoryResp | null> {
    const category = await this.prisma.shopCategory.findUnique({
      where: { id, deletedAt: null },
      include: {
        children: {
          where: { deletedAt: null },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!category) return null;
    return this.mapToResp(category, true);
  }

  static async createCategory(
    data: {
      name: string;
      parentId?: number | null;
      coverImage?: string;
      icon?: string;
      description?: string;
      sortOrder?: number;
      status?: number;
    },
    creatorId: number
  ): Promise<CategoryResp> {
    const category = await this.prisma.shopCategory.create({
      data: {
        name: data.name,
        parentId: data.parentId ?? null,
        coverImage: data.coverImage,
        icon: data.icon,
        description: data.description,
        sortOrder: data.sortOrder ?? 0,
        status: data.status ?? 1,
        creatorId,
        updaterId: creatorId,
      },
    });

    return this.mapToResp(category);
  }

  static async updateCategory(
    id: number,
    data: {
      name?: string;
      parentId?: number | null;
      coverImage?: string;
      icon?: string;
      description?: string;
      sortOrder?: number;
      status?: number;
    },
    updaterId: number
  ): Promise<CategoryResp> {
    const updateData: any = { updaterId };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.parentId !== undefined) updateData.parentId = data.parentId;
    if (data.coverImage !== undefined) updateData.coverImage = data.coverImage;
    if (data.icon !== undefined) updateData.icon = data.icon;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
    if (data.status !== undefined) updateData.status = data.status;

    const category = await this.prisma.shopCategory.update({
      where: { id },
      data: updateData,
      include: {
        children: {
          where: { deletedAt: null },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    return this.mapToResp(category, true);
  }

  static async deleteCategory(id: number): Promise<boolean> {
    await this.prisma.shopCategory.update({
      where: { id },
      data: { deletedAt: dateUtils.now() },
    });
    return true;
  }
}
