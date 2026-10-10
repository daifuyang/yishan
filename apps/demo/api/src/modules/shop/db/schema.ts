/**
 * shop 模块 Drizzle 表定义。
 *
 * 命名约定：表名以 `<meta.id>_` 为前缀。
 * 实体：categories / attributes (+ values) / products (+ skus + sku_attrs) / orders (+ items)。
 *
 * 价格字段用 decimal(10,2)。软删除用 deleted_at。
 */
import { sql } from 'drizzle-orm'
import {
  boolean,
  datetime,
  decimal,
  index,
  int,
  json,
  mysqlTable,
  text,
  tinyint,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core'

export const shopCategories = mysqlTable(
  'shop_categories',
  {
    id: int().primaryKey().autoincrement().notNull(),
    name: varchar({ length: 100 }).notNull(),
    parentId: int('parent_id'),
    coverImage: varchar('cover_image', { length: 500 }),
    icon: varchar({ length: 100 }),
    description: varchar({ length: 500 }),
    sortOrder: int('sort_order').notNull().default(0),
    status: tinyint().notNull().default(1),
    creatorId: int('creator_id').notNull(),
    createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
    updaterId: int('updater_id').notNull(),
    updatedAt: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
    deletedAt: datetime('deleted_at'),
    version: int().notNull().default(1),
  },
  (t) => ({
    idxStatus: index('idx_shop_categories_status').on(t.status),
    idxParent: index('idx_shop_categories_parent_id').on(t.parentId),
    idxSortOrder: index('idx_shop_categories_sort_order').on(t.sortOrder),
    idxDeletedAt: index('idx_shop_categories_deleted_at').on(t.deletedAt),
  }),
)

export const shopAttributes = mysqlTable(
  'shop_attributes',
  {
    id: int().primaryKey().autoincrement().notNull(),
    name: varchar({ length: 50 }).notNull(),
    type: tinyint().notNull().default(1),
    sortOrder: int('sort_order').notNull().default(0),
    status: tinyint().notNull().default(1),
    creatorId: int('creator_id').notNull(),
    createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
    updaterId: int('updater_id').notNull(),
    updatedAt: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
    deletedAt: datetime('deleted_at'),
    version: int().notNull().default(1),
  },
  (t) => ({
    idxStatus: index('idx_shop_attributes_status').on(t.status),
    idxType: index('idx_shop_attributes_type').on(t.type),
    idxDeletedAt: index('idx_shop_attributes_deleted_at').on(t.deletedAt),
  }),
)

export const shopAttributeValues = mysqlTable(
  'shop_attribute_values',
  {
    id: int().primaryKey().autoincrement().notNull(),
    attributeId: int('attribute_id').notNull(),
    value: varchar({ length: 100 }).notNull(),
    image: varchar({ length: 500 }),
    sortOrder: int('sort_order').notNull().default(0),
    status: tinyint().notNull().default(1),
    creatorId: int('creator_id').notNull(),
    createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
    updaterId: int('updater_id').notNull(),
    updatedAt: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
    deletedAt: datetime('deleted_at'),
    version: int().notNull().default(1),
  },
  (t) => ({
    idxAttrId: index('idx_shop_attribute_values_attr_id').on(t.attributeId),
    idxStatus: index('idx_shop_attribute_values_status').on(t.status),
    idxDeletedAt: index('idx_shop_attribute_values_deleted_at').on(t.deletedAt),
  }),
)

export const shopProducts = mysqlTable(
  'shop_products',
  {
    id: int().primaryKey().autoincrement().notNull(),
    categoryId: int('category_id').notNull(),
    name: varchar({ length: 200 }).notNull(),
    subtitle: varchar({ length: 500 }),
    coverImage: varchar('cover_image', { length: 500 }),
    images: json(),
    description: text(),
    price: decimal({ precision: 10, scale: 2 }).notNull(),
    costPrice: decimal('cost_price', { precision: 10, scale: 2 }),
    stock: int().notNull().default(0),
    unit: varchar({ length: 20 }).notNull().default('件'),
    weight: decimal({ precision: 10, scale: 2 }),
    status: tinyint().notNull().default(1),
    isHot: boolean('is_hot').notNull().default(false),
    isNew: boolean('is_new').notNull().default(false),
    sortOrder: int('sort_order').notNull().default(0),
    clickCount: int('click_count').notNull().default(0),
    creatorId: int('creator_id').notNull(),
    createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
    updaterId: int('updater_id').notNull(),
    updatedAt: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
    deletedAt: datetime('deleted_at'),
    version: int().notNull().default(1),
  },
  (t) => ({
    idxCategory: index('idx_shop_products_category').on(t.categoryId),
    idxStatus: index('idx_shop_products_status').on(t.status),
    idxHot: index('idx_shop_products_hot').on(t.isHot, t.status),
    idxNew: index('idx_shop_products_new').on(t.isNew, t.status),
    idxPrice: index('idx_shop_products_price').on(t.price),
    idxCreated: index('idx_shop_products_created').on(t.createdAt),
    idxDeletedAt: index('idx_shop_products_deleted_at').on(t.deletedAt),
  }),
)

export const shopProductSkus = mysqlTable(
  'shop_product_skus',
  {
    id: int().primaryKey().autoincrement().notNull(),
    productId: int('product_id').notNull(),
    skuCode: varchar('sku_code', { length: 64 }).notNull(),
    skuName: varchar('sku_name', { length: 500 }).notNull(),
    price: decimal({ precision: 10, scale: 2 }).notNull(),
    costPrice: decimal('cost_price', { precision: 10, scale: 2 }),
    stock: int().notNull().default(0),
    weight: decimal({ precision: 10, scale: 2 }),
    coverImage: varchar('cover_image', { length: 500 }),
    status: tinyint().notNull().default(1),
    creatorId: int('creator_id').notNull(),
    createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
    updaterId: int('updater_id').notNull(),
    updatedAt: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
    deletedAt: datetime('deleted_at'),
    version: int().notNull().default(1),
  },
  (t) => ({
    uniqSkuCode: uniqueIndex('uniq_shop_product_skus_sku_code').on(t.skuCode),
    idxProduct: index('idx_shop_product_skus_product').on(t.productId),
    idxStatus: index('idx_shop_product_skus_status').on(t.status),
    idxDeletedAt: index('idx_shop_product_skus_deleted_at').on(t.deletedAt),
  }),
)

export const shopSkuAttributes = mysqlTable(
  'shop_sku_attributes',
  {
    id: int().primaryKey().autoincrement().notNull(),
    skuId: int('sku_id').notNull(),
    attributeId: int('attribute_id').notNull(),
    valueId: int('value_id').notNull(),
  },
  (t) => ({
    idxSku: index('idx_shop_sku_attributes_sku').on(t.skuId),
    idxAttr: index('idx_shop_sku_attributes_attr').on(t.attributeId),
    idxValue: index('idx_shop_sku_attributes_value').on(t.valueId),
    uniq: uniqueIndex('uniq_shop_sku_attributes').on(t.skuId, t.attributeId, t.valueId),
  }),
)

export const shopOrders = mysqlTable(
  'shop_orders',
  {
    id: int().primaryKey().autoincrement().notNull(),
    orderNo: varchar('order_no', { length: 32 }).notNull(),
    userId: int('user_id').notNull(),
    totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),
    freightAmount: decimal('freight_amount', { precision: 10, scale: 2 }).notNull().default('0'),
    discountAmount: decimal('discount_amount', { precision: 10, scale: 2 }).notNull().default('0'),
    payAmount: decimal('pay_amount', { precision: 10, scale: 2 }).notNull(),
    payStatus: tinyint('pay_status').notNull().default(0),
    payTime: datetime('pay_time'),
    payMethod: varchar('pay_method', { length: 20 }),
    payTransactionId: varchar('pay_transaction_id', { length: 64 }),
    orderStatus: tinyint('order_status').notNull().default(1),
    expressCompany: varchar('express_company', { length: 50 }),
    expressNo: varchar('express_no', { length: 50 }),
    deliverTime: datetime('deliver_time'),
    receiveTime: datetime('receive_time'),
    cancelReason: varchar('cancel_reason', { length: 255 }),
    remark: varchar({ length: 500 }),
    status: tinyint().notNull().default(1),
    creatorId: int('creator_id').notNull(),
    createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
    updaterId: int('updater_id').notNull(),
    updatedAt: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
    deletedAt: datetime('deleted_at'),
    version: int().notNull().default(1),
  },
  (t) => ({
    uniqOrderNo: uniqueIndex('uniq_shop_orders_order_no').on(t.orderNo),
    idxUser: index('idx_shop_orders_user').on(t.userId),
    idxStatus: index('idx_shop_orders_status').on(t.orderStatus),
    idxPayStatus: index('idx_shop_orders_pay_status').on(t.payStatus),
    idxCreated: index('idx_shop_orders_created').on(t.createdAt),
    idxDeletedAt: index('idx_shop_orders_deleted_at').on(t.deletedAt),
    idxExpress: index('idx_shop_orders_express').on(t.expressNo),
  }),
)

export const shopOrderItems = mysqlTable(
  'shop_order_items',
  {
    id: int().primaryKey().autoincrement().notNull(),
    orderId: int('order_id').notNull(),
    productId: int('product_id').notNull(),
    skuId: int('sku_id'),
    skuName: varchar('sku_name', { length: 500 }),
    coverImage: varchar('cover_image', { length: 500 }),
    productName: varchar('product_name', { length: 200 }).notNull(),
    price: decimal({ precision: 10, scale: 2 }).notNull(),
    quantity: int().notNull(),
    subtotal: decimal({ precision: 10, scale: 2 }).notNull(),
    status: tinyint().notNull().default(1),
    creatorId: int('creator_id').notNull(),
    createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
    updaterId: int('updater_id').notNull(),
    updatedAt: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
    deletedAt: datetime('deleted_at'),
    version: int().notNull().default(1),
  },
  (t) => ({
    idxOrder: index('idx_shop_order_items_order').on(t.orderId),
    idxProduct: index('idx_shop_order_items_product').on(t.productId),
    idxSku: index('idx_shop_order_items_sku').on(t.skuId),
    idxDeletedAt: index('idx_shop_order_items_deleted_at').on(t.deletedAt),
  }),
)
