/**
 * 商城 Schema 注册
 */

import { Static, Type } from "@sinclair/typebox";
import { PaginationQuerySchema, successResponse } from "./common.js";
import { FastifyInstance } from "fastify";

// ===================== 通用响应 Schema =====================

const ShopIdRespSchema = Type.Object(
  { id: Type.Number({ description: "ID" }) },
  { $id: "shopIdResp" }
);

// ===================== 分类 Schema =====================

const ShopCategorySchema = Type.Object(
  {
    id: Type.Number({ description: "分类ID" }),
    name: Type.String({ description: "分类名称" }),
    parentId: Type.Union([Type.Number(), Type.Null()], { description: "父级ID" }),
    parentName: Type.Union([Type.String(), Type.Null()], { description: "父级名称" }),
    coverImage: Type.Union([Type.String(), Type.Null()], { description: "封面图" }),
    icon: Type.Union([Type.String(), Type.Null()], { description: "图标" }),
    description: Type.Union([Type.String(), Type.Null()], { description: "描述" }),
    sortOrder: Type.Number({ description: "排序" }),
    status: Type.String({ description: "状态" }),
    statusName: Type.String({ description: "状态名称" }),
    creatorId: Type.Number({ description: "创建人ID" }),
    creatorName: Type.Union([Type.String(), Type.Null()], { description: "创建人" }),
    createdAt: Type.String({ format: "date-time", description: "创建时间" }),
    updaterId: Type.Number({ description: "更新人ID" }),
    updaterName: Type.Union([Type.String(), Type.Null()], { description: "更新人" }),
    updatedAt: Type.String({ format: "date-time", description: "更新时间" }),
    children: Type.Optional(Type.Array(Type.Ref("shopCategory"))),
  },
  { $id: "shopCategory" }
);

export type CategoryResp = Static<typeof ShopCategorySchema>;

const CategoryListQuerySchema = Type.Object(
  {
    ...PaginationQuerySchema.properties,
    keyword: Type.Optional(Type.String({ description: "关键词" })),
    parentId: Type.Optional(Type.Integer({ description: "父级ID" })),
    status: Type.Optional(Type.String({ description: "状态" })),
    sortBy: Type.Optional(Type.String({ enum: ["sortOrder", "createdAt", "updatedAt"] })),
    sortOrder: Type.Optional(Type.String({ enum: ["asc", "desc"] })),
  },
  { $id: "shopCategoryListQuery" }
);

const CreateCategoryReqSchema = Type.Object(
  {
    name: Type.String({ description: "分类名称", minLength: 1, maxLength: 100 }),
    parentId: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    coverImage: Type.Optional(Type.String()),
    icon: Type.Optional(Type.String()),
    description: Type.Optional(Type.String()),
    sortOrder: Type.Optional(Type.Integer()),
    status: Type.Optional(Type.Integer()),
  },
  { $id: "shopCreateCategoryReq" }
);

const UpdateCategoryReqSchema = Type.Partial(CreateCategoryReqSchema, { $id: "shopUpdateCategoryReq", minProperties: 1 });

// ===================== 属性 Schema =====================

const ShopAttributeValueSchema = Type.Object(
  {
    id: Type.Number(),
    attributeId: Type.Number(),
    value: Type.String(),
    image: Type.Union([Type.String(), Type.Null()]),
    sortOrder: Type.Number(),
    status: Type.String(),
    creatorId: Type.Number(),
    createdAt: Type.String({ format: "date-time" }),
  },
  { $id: "shopAttributeValue" }
);

const ShopAttributeSchema = Type.Object(
  {
    id: Type.Number(),
    name: Type.String(),
    type: Type.Integer(),
    typeName: Type.String(),
    sortOrder: Type.Number(),
    status: Type.String(),
    statusName: Type.String(),
    creatorId: Type.Number(),
    creatorName: Type.Union([Type.String(), Type.Null()]),
    createdAt: Type.String({ format: "date-time" }),
    updaterId: Type.Number(),
    updaterName: Type.Union([Type.String(), Type.Null()]),
    updatedAt: Type.String({ format: "date-time" }),
    values: Type.Array(ShopAttributeValueSchema),
  },
  { $id: "shopAttribute" }
);

export type AttributeResp = Static<typeof ShopAttributeSchema>;
export type AttributeValueResp = Static<typeof ShopAttributeValueSchema>;

const AttributeListQuerySchema = Type.Object(
  {
    ...PaginationQuerySchema.properties,
    keyword: Type.Optional(Type.String()),
    type: Type.Optional(Type.Integer()),
    status: Type.Optional(Type.String()),
  },
  { $id: "shopAttributeListQuery" }
);

const CreateAttributeReqSchema = Type.Object(
  {
    name: Type.String({ minLength: 1, maxLength: 50 }),
    type: Type.Optional(Type.Integer()),
    sortOrder: Type.Optional(Type.Integer()),
    status: Type.Optional(Type.Integer()),
    values: Type.Optional(Type.Array(Type.Object({
      value: Type.String({ minLength: 1, maxLength: 100 }),
      image: Type.Optional(Type.String()),
      sortOrder: Type.Optional(Type.Integer()),
    }))),
  },
  { $id: "shopCreateAttributeReq" }
);

const CreateAttributeValueReqSchema = Type.Object(
  {
    value: Type.String({ minLength: 1, maxLength: 100 }),
    image: Type.Optional(Type.String()),
    sortOrder: Type.Optional(Type.Integer()),
  },
  { $id: "shopCreateAttributeValueReq" }
);

// ===================== SKU Schema =====================

const SkuAttributeSchema = Type.Object(
  {
    attributeId: Type.Number(),
    attributeName: Type.String(),
    valueId: Type.Number(),
    valueName: Type.String(),
    image: Type.Union([Type.String(), Type.Null()]),
  },
  { $id: "shopSkuAttribute" }
);

const ShopSkuSchema = Type.Object(
  {
    id: Type.Number(),
    productId: Type.Number(),
    productName: Type.Union([Type.String(), Type.Null()]),
    skuCode: Type.String(),
    skuName: Type.String(),
    price: Type.String(),
    costPrice: Type.Union([Type.String(), Type.Null()]),
    stock: Type.Number(),
    weight: Type.Union([Type.String(), Type.Null()]),
    coverImage: Type.Union([Type.String(), Type.Null()]),
    status: Type.String(),
    statusName: Type.String(),
    attributes: Type.Array(SkuAttributeSchema),
    creatorId: Type.Number(),
    creatorName: Type.Union([Type.String(), Type.Null()]),
    createdAt: Type.String({ format: "date-time" }),
    updaterId: Type.Number(),
    updaterName: Type.Union([Type.String(), Type.Null()]),
    updatedAt: Type.String({ format: "date-time" }),
  },
  { $id: "shopSku" }
);

export type SkuResp = Static<typeof ShopSkuSchema>;

const SkuListQuerySchema = Type.Object(
  {
    ...PaginationQuerySchema.properties,
    productId: Type.Optional(Type.Integer()),
    keyword: Type.Optional(Type.String()),
    status: Type.Optional(Type.String()),
  },
  { $id: "shopSkuListQuery" }
);

const CreateSkuReqSchema = Type.Object(
  {
    productId: Type.Integer(),
    skuCode: Type.String({ minLength: 1, maxLength: 64 }),
    skuName: Type.String({ minLength: 1, maxLength: 500 }),
    price: Type.Number({ minimum: 0 }),
    costPrice: Type.Optional(Type.Number({ minimum: 0 })),
    stock: Type.Optional(Type.Integer({ minimum: 0 })),
    weight: Type.Optional(Type.Number({ minimum: 0 })),
    coverImage: Type.Optional(Type.String()),
    status: Type.Optional(Type.Integer()),
    attributes: Type.Optional(Type.Array(Type.Object({
      attributeId: Type.Integer(),
      valueId: Type.Integer(),
    }))),
  },
  { $id: "shopCreateSkuReq" }
);

const UpdateSkuReqSchema = Type.Partial(CreateSkuReqSchema, { $id: "shopUpdateSkuReq", minProperties: 1 });

// ===================== 商品 Schema =====================

const ShopProductSchema = Type.Object(
  {
    id: Type.Number(),
    categoryId: Type.Number(),
    categoryName: Type.Union([Type.String(), Type.Null()]),
    name: Type.String(),
    subtitle: Type.Union([Type.String(), Type.Null()]),
    coverImage: Type.Union([Type.String(), Type.Null()]),
    images: Type.Optional(Type.Array(Type.String())),
    description: Type.Union([Type.String(), Type.Null()]),
    price: Type.String(),
    costPrice: Type.Union([Type.String(), Type.Null()]),
    stock: Type.Number(),
    unit: Type.String(),
    weight: Type.Union([Type.String(), Type.Null()]),
    status: Type.String(),
    statusName: Type.String(),
    isHot: Type.Boolean(),
    isNew: Type.Boolean(),
    isRecycle: Type.Boolean(),
    clickCount: Type.Number(),
    sortOrder: Type.Number(),
    creatorId: Type.Number(),
    creatorName: Type.Union([Type.String(), Type.Null()]),
    createdAt: Type.String({ format: "date-time" }),
    updaterId: Type.Number(),
    updaterName: Type.Union([Type.String(), Type.Null()]),
    updatedAt: Type.String({ format: "date-time" }),
    skus: Type.Array(ShopSkuSchema),
  },
  { $id: "shopProduct" }
);

export type ProductResp = Static<typeof ShopProductSchema>;

const ProductListQuerySchema = Type.Object(
  {
    ...PaginationQuerySchema.properties,
    keyword: Type.Optional(Type.String()),
    categoryId: Type.Optional(Type.Integer()),
    status: Type.Optional(Type.String()),
    isHot: Type.Optional(Type.Boolean()),
    isNew: Type.Optional(Type.Boolean()),
    isRecycle: Type.Optional(Type.Boolean()),
    sortBy: Type.Optional(Type.String({ enum: ["sortOrder", "createdAt", "updatedAt", "price", "clickCount"] })),
    sortOrder: Type.Optional(Type.String({ enum: ["asc", "desc"] })),
  },
  { $id: "shopProductListQuery" }
);

const CreateProductReqSchema = Type.Object(
  {
    categoryId: Type.Integer(),
    name: Type.String({ minLength: 1, maxLength: 200 }),
    subtitle: Type.Optional(Type.String({ maxLength: 500 })),
    coverImage: Type.Optional(Type.String()),
    images: Type.Optional(Type.Array(Type.String())),
    description: Type.Optional(Type.String()),
    price: Type.Number({ minimum: 0 }),
    costPrice: Type.Optional(Type.Number({ minimum: 0 })),
    stock: Type.Optional(Type.Integer({ minimum: 0 })),
    unit: Type.Optional(Type.String({ maxLength: 20 })),
    weight: Type.Optional(Type.Number({ minimum: 0 })),
    status: Type.Optional(Type.Integer()),
    isHot: Type.Optional(Type.Boolean()),
    isNew: Type.Optional(Type.Boolean()),
    sortOrder: Type.Optional(Type.Integer()),
    skus: Type.Optional(Type.Array(Type.Object({
      skuCode: Type.String({ minLength: 1, maxLength: 64 }),
      skuName: Type.String({ minLength: 1, maxLength: 500 }),
      price: Type.Number({ minimum: 0 }),
      costPrice: Type.Optional(Type.Number({ minimum: 0 })),
      stock: Type.Optional(Type.Integer({ minimum: 0 })),
      weight: Type.Optional(Type.Number({ minimum: 0 })),
      coverImage: Type.Optional(Type.String()),
      attributes: Type.Optional(Type.Array(Type.Object({
        attributeId: Type.Integer(),
        valueId: Type.Integer(),
      }))),
    }))),
  },
  { $id: "shopCreateProductReq" }
);

const UpdateProductReqSchema = Type.Partial(CreateProductReqSchema, { $id: "shopUpdateProductReq", minProperties: 1 });

const shopProductListResp = successResponse({ data: Type.Array(Type.Ref("shopProduct")), $id: "shopProductListResp", includePagination: true });
const shopProductDetailResp = successResponse({ data: Type.Ref("shopProduct"), $id: "shopProductDetailResp" });

// ===================== 订单 Schema =====================

const OrderItemSchema = Type.Object(
  {
    id: Type.Number(),
    orderId: Type.Number(),
    productId: Type.Number(),
    productName: Type.String(),
    skuId: Type.Union([Type.Number(), Type.Null()]),
    skuName: Type.Union([Type.String(), Type.Null()]),
    coverImage: Type.Union([Type.String(), Type.Null()]),
    price: Type.String(),
    quantity: Type.Integer(),
    subtotal: Type.String(),
    attributes: Type.Array(Type.Object({ attributeName: Type.String(), valueName: Type.String() })),
  },
  { $id: "shopOrderItem" }
);

const OrderAddressSchema = Type.Object(
  {
    receiver: Type.String(),
    phone: Type.String(),
    province: Type.String(),
    city: Type.String(),
    district: Type.String(),
    address: Type.String(),
    isDefault: Type.Boolean(),
  },
  { $id: "shopOrderAddress" }
);

const ShopOrderSchema = Type.Object(
  {
    id: Type.Number(),
    orderNo: Type.String(),
    userId: Type.Number(),
    userName: Type.String(),
    userPhone: Type.String(),
    addressId: Type.Number(),
    address: OrderAddressSchema,
    totalAmount: Type.String(),
    freightAmount: Type.String(),
    discountAmount: Type.String(),
    payAmount: Type.String(),
    payStatus: Type.String(),
    payStatusName: Type.String(),
    payTime: Type.Union([Type.String(), Type.Null()]),
    payMethod: Type.Union([Type.String(), Type.Null()]),
    payTransactionId: Type.Union([Type.String(), Type.Null()]),
    orderStatus: Type.String(),
    orderStatusName: Type.String(),
    expressCompany: Type.Union([Type.String(), Type.Null()]),
    expressNo: Type.Union([Type.String(), Type.Null()]),
    deliverTime: Type.Union([Type.String(), Type.Null()]),
    receiveTime: Type.Union([Type.String(), Type.Null()]),
    cancelReason: Type.Union([Type.String(), Type.Null()]),
    remark: Type.Union([Type.String(), Type.Null()]),
    status: Type.String(),
    creatorId: Type.Number(),
    creatorName: Type.Union([Type.String(), Type.Null()]),
    createdAt: Type.String({ format: "date-time" }),
    updaterId: Type.Number(),
    updaterName: Type.Union([Type.String(), Type.Null()]),
    updatedAt: Type.String({ format: "date-time" }),
    items: Type.Array(OrderItemSchema),
  },
  { $id: "shopOrder" }
);

export type OrderResp = Static<typeof ShopOrderSchema>;
export type OrderItemResp = Static<typeof OrderItemSchema>;

const shopOrderListResp = successResponse({ data: Type.Array(Type.Ref("shopOrder")), $id: "shopOrderListResp", includePagination: true });
const shopOrderDetailResp = successResponse({ data: Type.Ref("shopOrder"), $id: "shopOrderDetailResp" });

const OrderListQuerySchema = Type.Object(
  {
    ...PaginationQuerySchema.properties,
    keyword: Type.Optional(Type.String()),
    userId: Type.Optional(Type.Integer()),
    orderStatus: Type.Optional(Type.String()),
    payStatus: Type.Optional(Type.String()),
    startDate: Type.Optional(Type.String()),
    endDate: Type.Optional(Type.String()),
    sortBy: Type.Optional(Type.String({ enum: ["createdAt", "updatedAt"] })),
    sortOrder: Type.Optional(Type.String({ enum: ["asc", "desc"] })),
  },
  { $id: "shopOrderListQuery" }
);

const UpdateOrderStatusReqSchema = Type.Object(
  {
    orderStatus: Type.Optional(Type.String({ enum: ["1", "2", "3", "4", "5", "6"] })),
    cancelReason: Type.Optional(Type.String()),
  },
  { $id: "shopUpdateOrderStatusReq" }
);

const DeliverOrderReqSchema = Type.Object(
  {
    expressCompany: Type.String({ minLength: 1, maxLength: 50 }),
    expressNo: Type.String({ minLength: 1, maxLength: 50 }),
  },
  { $id: "deliverOrderReq" }
);

// ===================== 购物车 Schema =====================

const ShopCartSchema = Type.Object(
  {
    id: Type.Number(),
    userId: Type.Number(),
    productId: Type.Number(),
    productName: Type.String(),
    productCoverImage: Type.Union([Type.String(), Type.Null()]),
    skuId: Type.Union([Type.Number(), Type.Null()]),
    skuName: Type.Union([Type.String(), Type.Null()]),
    skuCoverImage: Type.Union([Type.String(), Type.Null()]),
    price: Type.String(),
    stock: Type.Number(),
    quantity: Type.Integer(),
    subtotal: Type.String(),
    attributes: Type.Array(SkuAttributeSchema),
    status: Type.String(),
    createdAt: Type.String({ format: "date-time" }),
    updatedAt: Type.String({ format: "date-time" }),
  },
  { $id: "shopCart" }
);

export type CartResp = Static<typeof ShopCartSchema>;

const AddToCartReqSchema = Type.Object(
  {
    productId: Type.Integer(),
    skuId: Type.Optional(Type.Integer()),
    quantity: Type.Integer({ minimum: 1 }),
  },
  { $id: "shopAddToCartReq" }
);

const UpdateCartReqSchema = Type.Object(
  { quantity: Type.Integer({ minimum: 1 }) },
  { $id: "shopUpdateCartReq" }
);

// ===================== 地址 Schema =====================

const ShopAddressSchema = Type.Object(
  {
    id: Type.Number(),
    userId: Type.Number(),
    userName: Type.Union([Type.String(), Type.Null()]),
    receiver: Type.String(),
    phone: Type.String(),
    province: Type.String(),
    city: Type.String(),
    district: Type.String(),
    address: Type.String(),
    fullAddress: Type.String(),
    isDefault: Type.Boolean(),
    status: Type.String(),
    statusName: Type.String(),
    creatorId: Type.Number(),
    createdAt: Type.String({ format: "date-time" }),
    updaterId: Type.Number(),
    updatedAt: Type.String({ format: "date-time" }),
  },
  { $id: "shopAddress" }
);

export type AddressResp = Static<typeof ShopAddressSchema>;

const CreateAddressReqSchema = Type.Object(
  {
    receiver: Type.String({ minLength: 1, maxLength: 50 }),
    phone: Type.String({ minLength: 1, maxLength: 20 }),
    province: Type.String({ minLength: 1, maxLength: 50 }),
    city: Type.String({ minLength: 1, maxLength: 50 }),
    district: Type.String({ minLength: 1, maxLength: 50 }),
    address: Type.String({ minLength: 1, maxLength: 255 }),
    isDefault: Type.Optional(Type.Boolean()),
  },
  { $id: "shopCreateAddressReq" }
);

const UpdateAddressReqSchema = Type.Partial(CreateAddressReqSchema, { $id: "shopUpdateAddressReq", minProperties: 1 });

// ===================== 注册所有 Schema =====================

const registerShopSchemas = (fastify: FastifyInstance) => {
  // 通用
  fastify.addSchema(ShopIdRespSchema);

  // 分类
  fastify.addSchema(ShopCategorySchema);
  fastify.addSchema(CategoryListQuerySchema);
  fastify.addSchema(CreateCategoryReqSchema);
  fastify.addSchema(UpdateCategoryReqSchema);

  // 属性
  fastify.addSchema(ShopAttributeValueSchema);
  fastify.addSchema(ShopAttributeSchema);
  fastify.addSchema(AttributeListQuerySchema);
  fastify.addSchema(CreateAttributeReqSchema);
  fastify.addSchema(CreateAttributeValueReqSchema);

  // SKU
  fastify.addSchema(SkuAttributeSchema);
  fastify.addSchema(ShopSkuSchema);
  fastify.addSchema(SkuListQuerySchema);
  fastify.addSchema(CreateSkuReqSchema);
  fastify.addSchema(UpdateSkuReqSchema);

  // 商品
  fastify.addSchema(ShopProductSchema);
  fastify.addSchema(ProductListQuerySchema);
  fastify.addSchema(CreateProductReqSchema);
  fastify.addSchema(UpdateProductReqSchema);
  fastify.addSchema(shopProductListResp);
  fastify.addSchema(shopProductDetailResp);

  // 订单
  fastify.addSchema(OrderItemSchema);
  fastify.addSchema(OrderAddressSchema);
  fastify.addSchema(ShopOrderSchema);
  fastify.addSchema(OrderListQuerySchema);
  fastify.addSchema(UpdateOrderStatusReqSchema);
  fastify.addSchema(DeliverOrderReqSchema);
  fastify.addSchema(shopOrderListResp);
  fastify.addSchema(shopOrderDetailResp);

  // 购物车
  fastify.addSchema(ShopCartSchema);
  fastify.addSchema(AddToCartReqSchema);
  fastify.addSchema(UpdateCartReqSchema);

  // 地址
  fastify.addSchema(ShopAddressSchema);
  fastify.addSchema(CreateAddressReqSchema);
  fastify.addSchema(UpdateAddressReqSchema);
};

export default registerShopSchemas;
export {
  ShopCategorySchema,
  CategoryListQuerySchema,
  CreateCategoryReqSchema,
  UpdateCategoryReqSchema,
  ShopAttributeSchema,
  AttributeListQuerySchema,
  CreateAttributeReqSchema,
  CreateAttributeValueReqSchema,
  ShopSkuSchema,
  SkuListQuerySchema,
  CreateSkuReqSchema,
  UpdateSkuReqSchema,
  ShopProductSchema,
  ProductListQuerySchema,
  CreateProductReqSchema,
  UpdateProductReqSchema,
  shopProductListResp,
  shopProductDetailResp,
  ShopOrderSchema,
  OrderListQuerySchema,
  UpdateOrderStatusReqSchema,
  DeliverOrderReqSchema,
  ShopCartSchema,
  AddToCartReqSchema,
  UpdateCartReqSchema,
  ShopAddressSchema,
  CreateAddressReqSchema,
  UpdateAddressReqSchema,
};
