/**
 * 订单数据访问模型
 */

import { prismaManager } from '@/utils/prisma.js'
import { dateUtils } from '../utils/date.js'

export interface OrderListQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  userId?: number;
  orderStatus?: string;
  payStatus?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: "createdAt" | "updatedAt";
  sortOrder?: "asc" | "desc";
}

export interface OrderItemResp {
  id: number;
  orderId: number;
  productId: number;
  productName: string;
  skuId: number | null;
  skuName: string | null;
  coverImage: string | null;
  price: string;
  quantity: number;
  subtotal: string;
  attributes: Array<{
    attributeName: string;
    valueName: string;
  }>;
}

export interface OrderResp {
  id: number;
  orderNo: string;
  userId: number;
  userName: string;
  userPhone: string;
  addressId: number;
  address: {
    receiver: string;
    phone: string;
    province: string;
    city: string;
    district: string;
    address: string;
    isDefault: boolean;
  };
  totalAmount: string;
  freightAmount: string;
  discountAmount: string;
  payAmount: string;
  payStatus: string;
  payStatusName: string;
  payTime: string | null;
  payMethod: string | null;
  payTransactionId: string | null;
  orderStatus: string;
  orderStatusName: string;
  expressCompany: string | null;
  expressNo: string | null;
  deliverTime: string | null;
  receiveTime: string | null;
  cancelReason: string | null;
  remark: string | null;
  status: string;
  creatorId: number;
  creatorName: string | null;
  createdAt: string;
  updaterId: number;
  updaterName: string | null;
  updatedAt: string;
  items: OrderItemResp[];
}

const payStatusMap: Record<number, string> = {
  0: "未支付",
  1: "已支付",
  2: "已退款",
};

const orderStatusMap: Record<number, string> = {
  1: "待付款",
  2: "待发货",
  3: "待收货",
  4: "已完成",
  5: "已取消",
  6: "已退款",
};

export class ShopOrderModel {
  private static prisma = prismaManager.getClient();

  private static mapOrderItemToResp(item: any): OrderItemResp {
    return {
      id: item.id,
      orderId: item.orderId,
      productId: item.productId,
      productName: item.productName,
      skuId: item.skuId,
      skuName: item.skuName ?? null,
      coverImage: item.coverImage ?? null,
      price: item.price.toString(),
      quantity: item.quantity,
      subtotal: item.subtotal.toString(),
      attributes: item.sku?.skuValues?.map((sv: any) => ({
        attributeName: sv.attribute.name,
        valueName: sv.value.value,
      })) || [],
    };
  }

  private static mapToResp(order: any): OrderResp {
    return {
      id: order.id,
      orderNo: order.orderNo,
      userId: order.userId,
      userName: order.user?.username ?? "",
      userPhone: order.user?.phone ?? "",
      addressId: order.addressId,
      address: {
        receiver: order.address.receiver,
        phone: order.address.phone,
        province: order.address.province,
        city: order.address.city,
        district: order.address.district,
        address: order.address.address,
        isDefault: order.address.isDefault,
      },
      totalAmount: order.totalAmount.toString(),
      freightAmount: order.freightAmount.toString(),
      discountAmount: order.discountAmount.toString(),
      payAmount: order.payAmount.toString(),
      payStatus: order.payStatus.toString(),
      payStatusName: payStatusMap[order.payStatus] || "未知",
      payTime: order.payTime ? dateUtils.formatISO(order.payTime) ?? null : null,
      payMethod: order.payMethod ?? null,
      payTransactionId: order.payTransactionId ?? null,
      orderStatus: order.orderStatus.toString(),
      orderStatusName: orderStatusMap[order.orderStatus] || "未知",
      expressCompany: order.expressCompany ?? null,
      expressNo: order.expressNo ?? null,
      deliverTime: order.deliverTime ? dateUtils.formatISO(order.deliverTime) ?? null : null,
      receiveTime: order.receiveTime ? dateUtils.formatISO(order.receiveTime) ?? null : null,
      cancelReason: order.cancelReason ?? null,
      remark: order.remark ?? null,
      status: order.status.toString(),
      creatorId: order.creatorId,
      creatorName: null,
      createdAt: dateUtils.formatISO(order.createdAt)!,
      updaterId: order.updaterId,
      updaterName: null,
      updatedAt: dateUtils.formatISO(order.updatedAt)!,
      items: order.items?.map((i: any) => this.mapOrderItemToResp(i)) || [],
    };
  }

  static async getOrderList(query: OrderListQuery): Promise<{ list: Partial<OrderResp>[]; total: number }> {
    const { page = 1, pageSize = 10, keyword, userId, orderStatus, payStatus, startDate, endDate } = query;

    const where: any = {
      deletedAt: null,
    };

    if (userId) {
      where.userId = userId;
    }

    if (orderStatus) {
      where.orderStatus = parseInt(orderStatus);
    }

    if (payStatus) {
      where.payStatus = parseInt(payStatus);
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        (where.createdAt as any).gte = new Date(startDate);
      }
      if (endDate) {
        (where.createdAt as any).lte = new Date(endDate);
      }
    }

    if (keyword) {
      where.OR = [
        { orderNo: { contains: keyword } },
        { user: { username: { contains: keyword } } },
      ];
    }

    const orderBy: any = {};
    const sortBy = query.sortBy || "createdAt";
    orderBy[sortBy] = query.sortOrder === "asc" ? "asc" : "desc";

    const [orders, total] = await Promise.all([
      this.prisma.shopOrder.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: { select: { username: true, phone: true } },
          address: true,
          items: true,
        },
      }),
      this.prisma.shopOrder.count({ where }),
    ]);

    return {
      list: orders.map((o: any) => ({
        id: o.id,
        orderNo: o.orderNo,
        userId: o.userId,
        userName: o.user?.username ?? "",
        userPhone: o.user?.phone ?? "",
        totalAmount: o.totalAmount.toString(),
        freightAmount: o.freightAmount.toString(),
        discountAmount: o.discountAmount.toString(),
        payAmount: o.payAmount.toString(),
        payStatus: o.payStatus.toString(),
        payStatusName: payStatusMap[o.payStatus] || "未知",
        orderStatus: o.orderStatus.toString(),
        orderStatusName: orderStatusMap[o.orderStatus] || "未知",
        expressNo: o.expressNo ?? null,
        receiver: o.address?.receiver ?? "",
        phone: o.address?.phone ?? "",
        createdAt: dateUtils.formatISO(o.createdAt)!,
      })),
      total,
    };
  }

  static async getOrderById(id: number): Promise<OrderResp | null> {
    const order = await this.prisma.shopOrder.findUnique({
      where: { id, deletedAt: null },
      include: {
        user: { select: { id: true, username: true, phone: true } },
        address: true,
        items: {
          include: {
            product: { select: { name: true } },
            sku: {
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
        },
      },
    });

    if (!order) return null;
    return this.mapToResp(order);
  }

  static async createOrder(data: any, creatorId: number): Promise<OrderResp> {
    const { items, remark, discountAmount, ...orderData } = data;
    const orderNo = this.generateOrderNo();

    const totalAmount = items.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);
    const payAmount = totalAmount - (discountAmount ?? 0);

    const itemSnapshots = await Promise.all(
      items.map(async (item: any) => {
        const product = await this.prisma.shopProduct.findUnique({
          where: { id: item.productId },
          select: { name: true, coverImage: true },
        });
        const sku = item.skuId
          ? await this.prisma.shopSku.findUnique({
              where: { id: item.skuId },
              include: {
                skuValues: {
                  include: {
                    attribute: true,
                    value: true,
                  },
                },
              },
            })
          : null;

        return {
          productId: item.productId,
          skuId: item.skuId ?? null,
          skuName: sku?.skuName ?? null,
          coverImage: sku?.coverImage ?? product?.coverImage ?? null,
          productName: product?.name ?? "",
          price: item.price,
          quantity: item.quantity,
          subtotal: item.price * item.quantity,
          status: 1,
          creatorId,
          updaterId: creatorId,
        };
      })
    );

    const order = await this.prisma.shopOrder.create({
      data: {
        orderNo,
        userId: orderData.userId,
        addressId: orderData.addressId,
        totalAmount,
        freightAmount: 0,
        discountAmount: discountAmount ?? 0,
        payAmount,
        payStatus: 0,
        orderStatus: 1,
        remark,
        creatorId,
        updaterId: creatorId,
        items: {
          create: itemSnapshots.map((item: any) => ({
            ...item,
          })),
        },
      },
      include: {
        user: { select: { username: true, phone: true } },
        address: true,
        items: {
          include: {
            product: { select: { name: true } },
            sku: {
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
        },
      },
    });

    return this.mapToResp(order);
  }

  static async updateOrderStatus(id: number, data: any, updaterId: number): Promise<OrderResp> {
    const updateData: any = { updaterId };

    if (data.orderStatus !== undefined) {
      updateData.orderStatus = data.orderStatus;
    }

    if (data.cancelReason !== undefined) {
      updateData.cancelReason = data.cancelReason;
    }

    if (data.orderStatus === 3) {
      updateData.deliverTime = dateUtils.now();
    }

    if (data.orderStatus === 4) {
      updateData.receiveTime = dateUtils.now();
    }

    const order = await this.prisma.shopOrder.update({
      where: { id },
      data: updateData,
      include: {
        user: { select: { username: true, phone: true } },
        address: true,
        items: {
          include: {
            product: { select: { name: true } },
            sku: {
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
        },
      },
    });

    return this.mapToResp(order);
  }

  static async deliverOrder(id: number, data: any, updaterId: number): Promise<OrderResp> {
    const order = await this.prisma.shopOrder.update({
      where: { id },
      data: {
        expressCompany: data.expressCompany,
        expressNo: data.expressNo,
        orderStatus: 3,
        deliverTime: dateUtils.now(),
        updaterId,
      },
      include: {
        user: { select: { username: true, phone: true } },
        address: true,
        items: {
          include: {
            product: { select: { name: true } },
            sku: {
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
        },
      },
    });

    return this.mapToResp(order);
  }

  static async deleteOrder(id: number): Promise<boolean> {
    await this.prisma.shopOrder.update({
      where: { id },
      data: { deletedAt: dateUtils.now() },
    });
    return true;
  }

  private static generateOrderNo(): string {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
    return `ORD${timestamp}${random}`;
  }
}
