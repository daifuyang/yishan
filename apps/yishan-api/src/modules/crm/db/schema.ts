/**
 * CRM 模块 Drizzle 表定义。
 *
 * 命名约定：所有表名以 `crm_` 为前缀（meta.id = 'crm'）。
 *
 * 实体关系：
 *   - crm_customer ↔ crm_contact：一对多（customerId）
 *   - crm_customer ↔ crm_activity：一对多（customerId）
 *   - crm_customer ↔ crm_tag：多对多（crm_customer_tag 桥接）
 *   - crm_customer_transfer：客户流转日志（一对多 from crm_customer）
 *
 * 客户负责人直接引用 sys_user.id；客户部门直接引用 sys_dept.id。
 * CRM 不创建独立 user / dept 表，所有身份都来自 Core。
 */
import { sql } from 'drizzle-orm'
import {
  datetime,
  index,
  int,
  mysqlTable,
  tinyint,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core'

export const crmCustomer = mysqlTable(
  'crm_customer',
  {
    id: int().primaryKey().autoincrement().notNull(),
    code: varchar({ length: 32 }),
    name: varchar({ length: 200 }).notNull(),
    type: varchar({ length: 16 }).notNull().default('enterprise'),
    statusId: int('status_id'),
    sourceId: int('source_id'),
    level: varchar({ length: 16 }),
    industry: varchar({ length: 64 }),
    phone: varchar({ length: 32 }),
    website: varchar({ length: 200 }),
    province: varchar({ length: 64 }),
    city: varchar({ length: 64 }),
    address: varchar({ length: 255 }),
    ownerUserId: int('owner_user_id'),
    ownerDepartmentId: int('owner_department_id'),
    poolStatus: varchar('pool_status', { length: 16 }).notNull().default('public'),
    lastFollowUpAt: datetime('last_follow_up_at'),
    nextFollowUpAt: datetime('next_follow_up_at'),
    remark: varchar({ length: 2000 }),
    creatorId: int('creator_id'),
    createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
    updaterId: int('updater_id'),
    updatedAt: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
    deletedAt: datetime('deleted_at'),
  },
  (t) => ({
    uniqCode: uniqueIndex('uniq_crm_customer_code').on(t.code),
    idxName: index('idx_crm_customer_name').on(t.name),
    idxPhone: index('idx_crm_customer_phone').on(t.phone),
    idxOwnerUser: index('idx_crm_customer_owner_user_id').on(t.ownerUserId),
    idxOwnerDept: index('idx_crm_customer_owner_department_id').on(t.ownerDepartmentId),
    idxPoolStatus: index('idx_crm_customer_pool_status').on(t.poolStatus),
    idxStatus: index('idx_crm_customer_status_id').on(t.statusId),
    idxSource: index('idx_crm_customer_source_id').on(t.sourceId),
    idxLastFollowUp: index('idx_crm_customer_last_follow_up_at').on(t.lastFollowUpAt),
    idxNextFollowUp: index('idx_crm_customer_next_follow_up_at').on(t.nextFollowUpAt),
    idxDeletedAt: index('idx_crm_customer_deleted_at').on(t.deletedAt),
    idxOwnerDeptStatus: index('idx_crm_customer_owner_dept_status').on(
      t.ownerDepartmentId,
      t.poolStatus,
    ),
  }),
)

export const crmContact = mysqlTable(
  'crm_contact',
  {
    id: int().primaryKey().autoincrement().notNull(),
    customerId: int('customer_id').notNull(),
    name: varchar({ length: 100 }).notNull(),
    gender: tinyint().notNull().default(0),
    mobile: varchar({ length: 32 }),
    phone: varchar({ length: 32 }),
    email: varchar({ length: 100 }),
    department: varchar({ length: 100 }),
    position: varchar({ length: 100 }),
    isPrimary: tinyint('is_primary').notNull().default(0),
    birthday: datetime(),
    remark: varchar({ length: 1000 }),
    creatorId: int('creator_id'),
    createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
    updaterId: int('updater_id'),
    updatedAt: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
    deletedAt: datetime('deleted_at'),
  },
  (t) => ({
    idxCustomer: index('idx_crm_contact_customer_id').on(t.customerId),
    idxMobile: index('idx_crm_contact_mobile').on(t.mobile),
    idxDeletedAt: index('idx_crm_contact_deleted_at').on(t.deletedAt),
  }),
)

export const crmActivity = mysqlTable(
  'crm_activity',
  {
    id: int().primaryKey().autoincrement().notNull(),
    customerId: int('customer_id').notNull(),
    contactId: int('contact_id'),
    type: varchar({ length: 16 }).notNull(),
    content: varchar({ length: 2000 }).notNull().default(''),
    occurredAt: datetime('occurred_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
    nextFollowUpAt: datetime('next_follow_up_at'),
    operatorUserId: int('operator_user_id').notNull(),
    createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
    updatedAt: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  },
  (t) => ({
    idxCustomer: index('idx_crm_activity_customer_id').on(t.customerId),
    idxOperator: index('idx_crm_activity_operator_user_id').on(t.operatorUserId),
    idxOccurredAt: index('idx_crm_activity_occurred_at').on(t.occurredAt),
    idxCustomerOccurred: index('idx_crm_activity_customer_occurred').on(t.customerId, t.occurredAt),
  }),
)

export const crmTag = mysqlTable(
  'crm_tag',
  {
    id: int().primaryKey().autoincrement().notNull(),
    name: varchar({ length: 50 }).notNull(),
    color: varchar({ length: 16 }),
    enabled: tinyint().notNull().default(1),
    createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
    updatedAt: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
    deletedAt: datetime('deleted_at'),
  },
  (t) => ({
    uniqName: uniqueIndex('uniq_crm_tag_name').on(t.name),
    idxDeletedAt: index('idx_crm_tag_deleted_at').on(t.deletedAt),
  }),
)

export const crmCustomerTag = mysqlTable(
  'crm_customer_tag',
  {
    customerId: int('customer_id').notNull(),
    tagId: int('tag_id').notNull(),
    createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  },
  (t) => ({
    uniqCustomerTag: uniqueIndex('uniq_crm_customer_tag').on(t.customerId, t.tagId),
    idxTag: index('idx_crm_customer_tag_tag_id').on(t.tagId),
  }),
)

export const crmCustomerStatus = mysqlTable(
  'crm_customer_status',
  {
    id: int().primaryKey().autoincrement().notNull(),
    name: varchar({ length: 50 }).notNull(),
    code: varchar({ length: 50 }),
    type: varchar({ length: 16 }).notNull().default('active'),
    sort: int().notNull().default(0),
    enabled: tinyint().notNull().default(1),
    isSystem: tinyint('is_system').notNull().default(0),
    createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
    updatedAt: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
    deletedAt: datetime('deleted_at'),
  },
  (t) => ({
    uniqName: uniqueIndex('uniq_crm_customer_status_name').on(t.name),
    idxDeletedAt: index('idx_crm_customer_status_deleted_at').on(t.deletedAt),
  }),
)

export const crmCustomerSource = mysqlTable(
  'crm_customer_source',
  {
    id: int().primaryKey().autoincrement().notNull(),
    name: varchar({ length: 50 }).notNull(),
    code: varchar({ length: 50 }),
    sort: int().notNull().default(0),
    enabled: tinyint().notNull().default(1),
    createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
    updatedAt: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
    deletedAt: datetime('deleted_at'),
  },
  (t) => ({
    uniqName: uniqueIndex('uniq_crm_customer_source_name').on(t.name),
    idxDeletedAt: index('idx_crm_customer_source_deleted_at').on(t.deletedAt),
  }),
)

export const crmCustomerTransfer = mysqlTable(
  'crm_customer_transfer',
  {
    id: int().primaryKey().autoincrement().notNull(),
    customerId: int('customer_id').notNull(),
    type: varchar({ length: 16 }).notNull(),
    fromUserId: int('from_user_id'),
    toUserId: int('to_user_id'),
    operatorUserId: int('operator_user_id').notNull(),
    reason: varchar({ length: 500 }),
    createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  },
  (t) => ({
    idxCustomer: index('idx_crm_customer_transfer_customer_id').on(t.customerId),
    idxCreatedAt: index('idx_crm_customer_transfer_created_at').on(t.createdAt),
  }),
)
