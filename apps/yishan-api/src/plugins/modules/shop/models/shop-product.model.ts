/**
 * 商品数据访问模型
 */

import { prismaManager } from '@/utils/prisma.js'
import { dateUtils } from '../utils/date.js'

type ProductWithRelations = any;

export interface ProductListQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  categoryId?: number;
  status?: string;
  isHot?: boolean;
  isNew?: boolean;
  isRecycle?: boolean;
  sortBy?: "sortOrder" | "createdAt" | "updatedAt" | "price" | "clickCount";
  sortOrder?: "asc" | "desc";
}

export interface SkuResp {
  id: number;
  productId: number;
  skuCode: string;
  skuName: string;
  price: string;
  costPrice: string | null;
  stock: number;
  weight: string | null;
  coverImage: string | null;
  status: string;
  attributes: Array<{
    attributeId: number;
    attributeName: string;
    valueId: number;
    valueName: string;
    image: string | null;
  }>;
}

export interface ProductResp {
  id: number;
  categoryId: number;
  categoryName: string | null;
  name: string;
  subtitle: string | null;
  coverImage: string | null;
  images: string[] | null;
  description: string | null;
  price: string;
  costPrice: string | null;
  stock: number;
  unit: string;
  weight: string | null;
  status: string;
  statusName: string;
  isHot: boolean;
  isNew: boolean;
  isRecycle: boolean;
  clickCount: number;
  sortOrder: number;
  creatorId: number;
  creatorName: string | null;
  createdAt: string;
  updaterId: number;
  updaterName: string | null;
  updatedAt: string;
  skus: SkuResp[];
}

const statusMap: Record<number, string> = {
  0: "已下架",
  1: "上架中",
};

export class ShopProductModel {
  private static prisma = prismaManager.getClient();

  private static mapSkuToResp(sku: any): SkuResp {
    return {
      id: sku.id,
      productId: sku.productId,
      skuCode: sku.skuCode,
      skuName: sku.skuName,
      price: sku.price.toString(),
      costPrice: sku.costPrice?.toString() ?? null,
      stock: sku.stock,
      weight: sku.weight?.toString() ?? null,
      coverImage: sku.coverImage ?? null,
      status: sku.status.toString(),
      attributes: sku.skuValues?.map((sv: any) => ({
        attributeId: sv.attributeId,
        attributeName: sv.attribute.name,
        valueId: sv.valueId,
        valueName: sv.value.value,
        image: sv.value.image ?? null,
      })) || [],
    };
  }

  private static mapToResp(product: ProductWithRelations): ProductResp {
    return {
      id: product.id,
      categoryId: product.categoryId,
      categoryName: product.category?.name ?? null,
      name: product.name,
      subtitle: product.subtitle ?? null,
      coverImage: product.coverImage ?? null,
      images: (product.images as string[]) ?? null,
      description: product.description ?? null,
      price: product.price.toString(),
      costPrice: product.costPrice?.toString() ?? null,
      stock: product.stock,
      unit: product.unit,
      weight: product.weight?.toString() ?? null,
      status: product.status.toString(),
      statusName: statusMap[product.status] || "未知",
      isHot: product.isHot,
      isNew: product.isNew,
      isRecycle: product.isRecycle,
      clickCount: product.clickCount,
      sortOrder: product.sortOrder,
      creatorId: product.creatorId,
      creatorName: null,
      createdAt: dateUtils.formatISO(product.createdAt)!,
      updaterId: product.updaterId,
      updaterName: null,
      updatedAt: dateUtils.formatISO(product.updatedAt)!,
      skus: product.skus?.map((s: any) => this.mapSkuToResp(s)) || [],
    };
  }

  static async getProductList(query: ProductListQuery): Promise<{ list: Partial<ProductResp>[]; total: number }> {
    const { page = 1, pageSize = 10, keyword, categoryId, status, isHot, isNew, isRecycle } = query;

    const where: any = {
      deletedAt: null,
      isRecycle: isRecycle ?? false,
    };

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (status) {
      where.status = parseInt(status);
    }

    if (isHot !== undefined) {
      where.isHot = isHot;
    }

    if (isNew !== undefined) {
      where.isNew = isNew;
    }

    if (keyword) {
      where.OR = [
        { name: { contains: keyword } },
        { subtitle: { contains: keyword } },
      ];
    }

    const orderBy: any = {};
    const sortBy = query.sortBy || "sortOrder";
    const sortOrder = query.sortOrder === "asc" ? "asc" : "desc";
    orderBy[sortBy] = sortOrder;

    const [products, total] = await Promise.all([
      this.prisma.shopProduct.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          category: { select: { name: true } },
        },
      }),
      this.prisma.shopProduct.count({ where }),
    ]);

    return {
      list: products.map((p: any) => ({
        id: p.id,
        categoryId: p.categoryId,
        categoryName: p.category?.name ?? null,
        name: p.name,
        subtitle: p.subtitle ?? null,
        coverImage: p.coverImage ?? null,
        images: p.images ?? null,
        description: p.description ?? null,
        price: p.price.toString(),
        costPrice: p.costPrice?.toString() ?? null,
        stock: p.stock,
        unit: p.unit,
        weight: p.weight?.toString() ?? null,
        status: p.status.toString(),
        statusName: statusMap[p.status] || "未知",
        isHot: p.isHot,
        isNew: p.isNew,
        isRecycle: p.isRecycle,
        clickCount: p.clickCount,
        sortOrder: p.sortOrder,
        creatorId: p.creatorId,
        creatorName: null,
        createdAt: dateUtils.formatISO(p.createdAt)!,
        updaterId: p.updaterId,
        updaterName: null,
        updatedAt: dateUtils.formatISO(p.updatedAt)!,
        skus: [],
      })),
      total,
    };
  }

  static async getProductById(id: number): Promise<ProductResp | null> {
    const product = await this.prisma.shopProduct.findUnique({
      where: { id, deletedAt: null },
      include: {
        category: { select: { id: true, name: true } },
        skus: {
          where: { deletedAt: null },
          orderBy: { id: "asc" },
          include: {
            skuValues: {
              include: {
                attribute: true,
                value: true,
              },
            },
          },
        },
      },
    });

    if (!product) return null;
    return this.mapToResp(product);
  }

  static async createProduct(
    data: any,
    creatorId: number
  ): Promise<ProductResp> {
    const { skus, ...productData } = data;

    let totalStock = productData.stock ?? 0;
    if (skus && skus.length > 0) {
      totalStock = skus.reduce((sum: number, sku: any) => sum + (sku.stock ?? 0), 0);
    }

    const product = await this.prisma.shopProduct.create({
      data: {
        categoryId: productData.categoryId,
        name: productData.name,
        subtitle: productData.subtitle,
        coverImage: productData.coverImage,
        images: productData.images,
        description: productData.description,
        price: productData.price,
        costPrice: productData.costPrice,
        stock: totalStock,
        unit: productData.unit ?? "件",
        weight: productData.weight,
        status: productData.status ?? 1,
        isHot: productData.isHot ?? false,
        isNew: productData.isNew ?? false,
        sortOrder: productData.sortOrder ?? 0,
        creatorId,
        updaterId: creatorId,
        skus: skus ? {
          create: skus.map((sku: any) => ({
            skuCode: sku.skuCode,
            skuName: sku.skuName,
            price: sku.price,
            costPrice: sku.costPrice,
            stock: sku.stock ?? 0,
            weight: sku.weight,
            coverImage: sku.coverImage,
            status: 1,
            creatorId,
            updaterId: creatorId,
            skuValues: sku.attributes ? {
              create: sku.attributes.map((attr: any) => ({
                attributeId: attr.attributeId,
                valueId: attr.valueId,
              })),
            } : undefined,
          })),
        } : undefined,
      },
      include: {
        category: { select: { name: true } },
        skus: {
          where: { deletedAt: null },
          include: {
            skuValues: {
              include: {
                attribute: true,
                value: true,
              },
            },
          },
        },
      },
    });

    return this.mapToResp(product);
  }

  static async updateProduct(
    id: number,
    data: any,
    updaterId: number
  ): Promise<ProductResp> {
    const updateData: any = { ...data, updaterId };

    const product = await this.prisma.shopProduct.update({
      where: { id },
      data: updateData,
      include: {
        category: { select: { name: true } },
        skus: {
          where: { deletedAt: null },
          include: {
            skuValues: {
              include: {
                attribute: true,
                value: true,
              },
            },
          },
        },
      },
    });

    return this.mapToResp(product);
  }

  static async updateProductStock(id: number, updaterId: number): Promise<void> {
    const skus = await this.prisma.shopSku.findMany({
      where: { productId: id, deletedAt: null },
      select: { stock: true },
    });

    const totalStock = skus.reduce((sum: number, sku: any) => sum + sku.stock, 0);

    await this.prisma.shopProduct.update({
      where: { id },
      data: { stock: totalStock, updaterId },
    });
  }

  static async deleteProduct(id: number): Promise<boolean> {
    await this.prisma.shopProduct.update({
      where: { id },
      data: { deletedAt: dateUtils.now() },
    });
    return true;
  }

  static async moveToRecycle(id: number, updaterId: number): Promise<void> {
    await this.prisma.shopProduct.update({
      where: { id },
      data: { isRecycle: true, status: 0, updaterId },
    });
  }

  static async restoreFromRecycle(id: number, updaterId: number): Promise<void> {
    await this.prisma.shopProduct.update({
      where: { id },
      data: { isRecycle: false, updaterId },
    });
  }
}
