/**
 * SKU 数据访问模型
 */

import { prismaManager } from '@/utils/prisma.js'
import { dateUtils } from '../utils/date.js'
import { ShopProductModel } from './shop-product.model.js'

export interface SkuListQuery {
  page?: number;
  pageSize?: number;
  productId?: number;
  keyword?: string;
  status?: string;
}

export interface SkuResp {
  id: number;
  productId: number;
  productName: string | null;
  skuCode: string;
  skuName: string;
  price: string;
  costPrice: string | null;
  stock: number;
  weight: string | null;
  coverImage: string | null;
  status: string;
  statusName: string;
  attributes: Array<{
    attributeId: number;
    attributeName: string;
    valueId: number;
    valueName: string;
    image: string | null;
  }>;
  creatorId: number;
  creatorName: string | null;
  createdAt: string;
  updaterId: number;
  updaterName: string | null;
  updatedAt: string;
}

const statusMap: Record<number, string> = {
  0: "已下架",
  1: "上架中",
};

export class ShopSkuModel {
  private static prisma = prismaManager.getClient();

  private static mapToResp(sku: any): SkuResp {
    return {
      id: sku.id,
      productId: sku.productId,
      productName: sku.product?.name ?? null,
      skuCode: sku.skuCode,
      skuName: sku.skuName,
      price: sku.price.toString(),
      costPrice: sku.costPrice?.toString() ?? null,
      stock: sku.stock,
      weight: sku.weight?.toString() ?? null,
      coverImage: sku.coverImage ?? null,
      status: sku.status.toString(),
      statusName: statusMap[sku.status] || "未知",
      attributes: sku.skuValues?.map((sv: any) => ({
        attributeId: sv.attributeId,
        attributeName: sv.attribute.name,
        valueId: sv.valueId,
        valueName: sv.value.value,
        image: sv.value.image ?? null,
      })) || [],
      creatorId: sku.creatorId,
      creatorName: null,
      createdAt: dateUtils.formatISO(sku.createdAt)!,
      updaterId: sku.updaterId,
      updaterName: null,
      updatedAt: dateUtils.formatISO(sku.updatedAt)!,
    };
  }

  static async getSkuList(query: SkuListQuery): Promise<{ list: SkuResp[]; total: number }> {
    const { page = 1, pageSize = 10, productId, keyword, status } = query;

    const where: any = {
      deletedAt: null,
    };

    if (productId) {
      where.productId = productId;
    }

    if (status) {
      where.status = parseInt(status);
    }

    if (keyword) {
      where.OR = [
        { skuCode: { contains: keyword } },
        { skuName: { contains: keyword } },
        { product: { name: { contains: keyword } } },
      ];
    }

    const [skus, total] = await Promise.all([
      this.prisma.shopSku.findMany({
        where,
        orderBy: { id: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          product: { select: { name: true } },
          skuValues: {
            include: {
              attribute: true,
              value: true,
            },
          },
        },
      }),
      this.prisma.shopSku.count({ where }),
    ]);

    return {
      list: skus.map((s: any) => this.mapToResp(s)),
      total,
    };
  }

  static async getSkuById(id: number): Promise<SkuResp | null> {
    const sku = await this.prisma.shopSku.findUnique({
      where: { id, deletedAt: null },
      include: {
        product: { select: { name: true } },
        skuValues: {
          include: {
            attribute: true,
            value: true,
          },
        },
      },
    });

    if (!sku) return null;
    return this.mapToResp(sku);
  }

  static async getSkusByProductId(productId: number): Promise<SkuResp[]> {
    const skus = await this.prisma.shopSku.findMany({
      where: { productId, deletedAt: null },
      orderBy: { id: "asc" },
      include: {
        product: { select: { name: true } },
        skuValues: {
          include: {
            attribute: true,
            value: true,
          },
        },
      },
    });

    return skus.map((s: any) => this.mapToResp(s));
  }

  static async createSku(data: any, creatorId: number): Promise<SkuResp> {
    const sku = await this.prisma.shopSku.create({
      data: {
        productId: data.productId,
        skuCode: data.skuCode,
        skuName: data.skuName,
        price: data.price,
        costPrice: data.costPrice,
        stock: data.stock ?? 0,
        weight: data.weight,
        coverImage: data.coverImage,
        status: data.status ?? 1,
        creatorId,
        updaterId: creatorId,
        skuValues: data.attributes ? {
          create: data.attributes.map((attr: any) => ({
            attributeId: attr.attributeId,
            valueId: attr.valueId,
          })),
        } : undefined,
      },
      include: {
        product: { select: { name: true } },
        skuValues: {
          include: {
            attribute: true,
            value: true,
          },
        },
      },
    });

    await ShopProductModel.updateProductStock(data.productId, creatorId);

    return this.mapToResp(sku);
  }

  static async updateSku(id: number, data: any, updaterId: number): Promise<SkuResp> {
    const existingSku = await this.prisma.shopSku.findUnique({
      where: { id },
      select: { productId: true },
    });

    if (!existingSku) {
      throw new Error("SKU不存在");
    }

    if (data.attributes !== undefined) {
      await this.prisma.shopSkuAttribute.deleteMany({
        where: { skuId: id },
      });
    }

    const updateData: any = { ...data, updaterId };

    const sku = await this.prisma.shopSku.update({
      where: { id },
      data: {
        ...updateData,
        skuValues: data.attributes ? {
          create: data.attributes.map((attr: any) => ({
            attributeId: attr.attributeId,
            valueId: attr.valueId,
          })),
        } : undefined,
      },
      include: {
        product: { select: { name: true } },
        skuValues: {
          include: {
            attribute: true,
            value: true,
          },
        },
      },
    });

    await ShopProductModel.updateProductStock(sku.productId, updaterId);

    return this.mapToResp(sku);
  }

  static async deleteSku(id: number, updaterId: number): Promise<boolean> {
    const sku = await this.prisma.shopSku.findUnique({
      where: { id },
      select: { productId: true },
    });

    await this.prisma.shopSku.update({
      where: { id },
      data: { deletedAt: dateUtils.now(), updaterId },
    });

    if (sku) {
      await ShopProductModel.updateProductStock(sku.productId, updaterId);
    }

    return true;
  }

  static async updateStock(id: number, stock: number, updaterId: number): Promise<void> {
    const sku = await this.prisma.shopSku.findUnique({
      where: { id },
      select: { productId: true },
    });

    await this.prisma.shopSku.update({
      where: { id },
      data: { stock, updaterId },
    });

    if (sku) {
      await ShopProductModel.updateProductStock(sku.productId, updaterId);
    }
  }
}
