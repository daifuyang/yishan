/**
 * CRM 模块 Drizzle 表定义。
 *
 * 命名约定：所有表名以 `crm_` 为前缀（meta.id = 'crm'）。
 *
 * 实体关系：
 *   - crm_customer ↔ crm_contact：一对多（customerId）
 *   - crm_customer ↔ crm_activity：一对多（customerId）
 *   - crm_customer ↔ crm_tag：多对多（crm_customer_tag 桥接）
 *   - crm_customer ↔ crm_customer_member：一对多（协同人；owner 仍以 crm_customer.owner_user_id 为唯一真相）
 *   - crm_customer_transfer：客户流转日志（一对多 from crm_customer）
 *
 * 客户负责人直接引用 sys_user.id；客户部门直接引用 sys_dept.id。
 * CRM 不创建独立 user / dept 表，所有身份都来自 Core。
 */
import { sql } from 'drizzle-orm'
import {
  bigint,
  datetime,
  index,
  int,
  json,
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
    /**
     * Phase 0 引入 sys_enum(type='crm_customer_status') 后，业务侧开始双写。
     * 新路径优先使用 *_code 列；旧 *_id / * 字符串列保留以便平滑迁移。
     * Phase 1 验证新路径稳定后，迁移脚本最后一步允许 drop 旧列。
     */
    statusCode: varchar('status_code', { length: 64 }),
    sourceCode: varchar('source_code', { length: 64 }),
    levelCode: varchar('level_code', { length: 64 }),
    industryCode: varchar('industry_code', { length: 64 }),
    phone: varchar({ length: 32 }),
    website: varchar({ length: 200 }),
    province: varchar({ length: 64 }),
    city: varchar({ length: 64 }),
    address: varchar({ length: 255 }),
    ownerUserId: int('owner_user_id'),
    ownerDepartmentId: int('owner_department_id'),
    poolStatus: varchar('pool_status', { length: 16 }).notNull().default('public'),
    /**
     * Phase 1 引入：客户进入公海的时刻（assign(null) / 退回公海时刷新）。
     * 公海排序、入池时长统计都基于此字段。
     */
    poolEnteredAt: datetime('pool_entered_at'),
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
    idxPoolEnteredAt: index('idx_crm_customer_pool_entered_at').on(t.poolEnteredAt),
    idxStatus: index('idx_crm_customer_status_id').on(t.statusId),
    idxSource: index('idx_crm_customer_source_id').on(t.sourceId),
    idxStatusCode: index('idx_crm_customer_status_code').on(t.statusCode),
    idxSourceCode: index('idx_crm_customer_source_code').on(t.sourceCode),
    idxLevelCode: index('idx_crm_customer_level_code').on(t.levelCode),
    idxIndustryCode: index('idx_crm_customer_industry_code').on(t.industryCode),
    idxLastFollowUp: index('idx_crm_customer_last_follow_up_at').on(t.lastFollowUpAt),
    idxNextFollowUp: index('idx_crm_customer_next_follow_up_at').on(t.nextFollowUpAt),
    idxDeletedAt: index('idx_crm_customer_deleted_at').on(t.deletedAt),
    idxOwnerDeptStatus: index('idx_crm_customer_owner_dept_status').on(
      t.ownerDepartmentId,
      t.poolStatus,
    ),
  }),
)

/** 尚未验证、尚未转化为客户的获客信息。 */
export const crmLead = mysqlTable(
  'crm_lead',
  {
    id: int().primaryKey().autoincrement().notNull(),
    name: varchar({ length: 100 }),
    companyName: varchar('company_name', { length: 200 }),
    mobile: varchar({ length: 32 }),
    phone: varchar({ length: 32 }),
    email: varchar({ length: 100 }),
    wechat: varchar({ length: 64 }),
    qq: varchar({ length: 32 }),
    sourceId: int('source_id'),
    intention: varchar({ length: 2000 }),
    status: varchar({ length: 16 }).notNull().default('pending'),
    ownerUserId: int('owner_user_id'),
    ownerDepartmentId: int('owner_department_id'),
    lastFollowUpAt: datetime('last_follow_up_at'),
    nextFollowUpAt: datetime('next_follow_up_at'),
    disqualifyReason: varchar('disqualify_reason', { length: 500 }),
    /** 标准化作废原因代码：duplicate / not_target / no_demand / unreachable / invalid_contact / rejected / other */
    disqualifyCode: varchar('disqualify_code', { length: 32 }),
    convertedCustomerId: int('converted_customer_id'),
    convertedContactId: int('converted_contact_id'),
    convertedAt: datetime('converted_at'),
    creatorId: int('creator_id'),
    createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
    updaterId: int('updater_id'),
    updatedAt: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
    deletedAt: datetime('deleted_at'),
  },
  (t) => ({
    idxStatus: index('idx_crm_lead_status').on(t.status),
    idxOwner: index('idx_crm_lead_owner').on(t.ownerUserId, t.ownerDepartmentId),
    idxMobile: index('idx_crm_lead_mobile').on(t.mobile),
    idxEmail: index('idx_crm_lead_email').on(t.email),
    idxNextFollowUp: index('idx_crm_lead_next_follow_up_at').on(t.nextFollowUpAt),
    idxDeletedAt: index('idx_crm_lead_deleted_at').on(t.deletedAt),
    idxDisqualifyCode: index('idx_crm_lead_disqualify_code').on(t.disqualifyCode),
  }),
)

/** 线索的人工跟进记录。与客户活动分表，避免改变客户查询和数据契约。 */
export const crmLeadActivity = mysqlTable(
  'crm_lead_activity',
  {
    id: int().primaryKey().autoincrement().notNull(),
    leadId: int('lead_id').notNull(),
    type: varchar({ length: 16 }).notNull(),
    content: varchar({ length: 2000 }).notNull().default(''),
    occurredAt: datetime('occurred_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
    nextFollowUpAt: datetime('next_follow_up_at'),
    operatorUserId: int('operator_user_id').notNull(),
    createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
    updatedAt: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  },
  (t) => ({
    idxLead: index('idx_crm_lead_activity_lead_id').on(t.leadId),
    idxOperator: index('idx_crm_lead_activity_operator_user_id').on(t.operatorUserId),
    idxLeadOccurred: index('idx_crm_lead_activity_lead_occurred').on(t.leadId, t.occurredAt),
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
    /**
     * Phase 1 引入：联系人决策角色（最终决策人 / 影响者 / 使用者 / 普通联系人）。
     * 由 sys_enum(type='crm_contact_role') 维护。
     */
    roleCode: varchar('role_code', { length: 64 }),
    /**
     * Phase 1 引入：联系人状态（active / paused / invalid）。
     * 停用联系人不能作为新商机主要联系人。
     */
    statusCode: varchar('status_code', { length: 64 }).notNull().default('active'),
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
    idxRoleCode: index('idx_crm_contact_role_code').on(t.roleCode),
    idxStatusCode: index('idx_crm_contact_status_code').on(t.statusCode),
    /**
     * Phase 1：每客户主联系人唯一性。
     *
     * MySQL 没有 partial unique index；改用 service 层在事务内做
     * "设置主联系人前先清零其它" 的强校验（见 ContactService.setPrimary）。
     * 索引 (customer_id, is_primary) 加快列表查找，不参与唯一性。
     */
    idxCustomerPrimary: index('idx_crm_contact_customer_primary').on(t.customerId, t.isPrimary),
  }),
)

export const crmActivity = mysqlTable(
  'crm_activity',
  {
    id: int().primaryKey().autoincrement().notNull(),
    customerId: int('customer_id'),
    contactId: int('contact_id'),
    /**
     * Phase 1 引入 polymorphic：业务对象 + id 组合。
     *
     *   entity_type ∈ { 'lead', 'customer', 'opportunity', 'contract' }
     *   entity_id  对应 crm_lead.id / crm_customer.id / crm_opportunity.id / crm_contract.id
     *
     * 旧 customer_id 列暂时保留：数据迁移期与新列双写，新业务只写 entity_*。
     * Phase 1 验证稳定后，最后一步允许 drop 旧 customer_id / contact_id 列。
     *
     * entity_ref_type 是冗余字段，给"客户活动视图"等场景用：实体虽然 polymorphic，
     * 但 UI 经常按"来源实体"分类（lead 跟进 vs customer 跟进）。
     */
    entityType: varchar('entity_type', { length: 32 }),
    entityId: int('entity_id'),
    entityRefType: varchar('entity_ref_type', { length: 32 }),
    type: varchar({ length: 32 }).notNull(),
    content: varchar({ length: 2000 }).notNull().default(''),
    occurredAt: datetime('occurred_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
    nextFollowUpAt: datetime('next_follow_up_at'),
    /**
     * Phase 4 引入：拜访专用字段。
     * 复用 crm_activity(type='visit')，plannedAt / location / participants / visitResultCode / summary
     * 都可空；非 visit 类型不写。
     */
    plannedAt: datetime('planned_at'),
    location: varchar({ length: 255 }),
    participants: varchar({ length: 500 }),
    visitResultCode: varchar('visit_result_code', { length: 64 }),
    summary: varchar({ length: 1000 }),
    operatorUserId: int('operator_user_id').notNull(),
    createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
    updatedAt: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
    deletedAt: datetime('deleted_at'),
  },
  (t) => ({
    idxCustomer: index('idx_crm_activity_customer_id').on(t.customerId),
    idxOperator: index('idx_crm_activity_operator_user_id').on(t.operatorUserId),
    idxOccurredAt: index('idx_crm_activity_occurred_at').on(t.occurredAt),
    idxCustomerOccurred: index('idx_crm_activity_customer_occurred').on(t.customerId, t.occurredAt),
    idxEntity: index('idx_crm_activity_entity').on(t.entityType, t.entityId, t.occurredAt),
    idxType: index('idx_crm_activity_type').on(t.type),
    idxPlannedAt: index('idx_crm_activity_planned_at').on(t.plannedAt),
    idxDeletedAt: index('idx_crm_activity_deleted_at').on(t.deletedAt),
  }),
)

/**
 * 客户协同人。
 *
 * 负责人（owner）的唯一真相始终是 `crm_customer.owner_user_id`；本表只承载协同人
 * （collaborator），不重复存 owner，避免出现两个数据源导致 owner 不一致。
 * `role` 目前恒为 'collaborator'，保留字段是为了将来扩展只读/协作等细分角色。
 */
export const crmCustomerMember = mysqlTable(
  'crm_customer_member',
  {
    id: int().primaryKey().autoincrement().notNull(),
    customerId: int('customer_id').notNull(),
    userId: int('user_id').notNull(),
    role: varchar({ length: 16 }).notNull().default('collaborator'),
    creatorId: int('creator_id'),
    createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  },
  (t) => ({
    uniqCustomerUser: uniqueIndex('uniq_crm_customer_member').on(t.customerId, t.userId),
    idxUser: index('idx_crm_customer_member_user_id').on(t.userId),
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

/**
 * 产品分类（小字典表，code 唯一，不存在 BIGINT）。
 *
 * 设计要点：
 *   - 用 code 而不是 id 作为外键引用，避免在报价快照中暴露内部自增。
 *   - parentCode 自引用本表.code；MySQL 没有 partial unique index，
 *     不在 schema 层保证 root category 的 parentCode=null，由 service 层负责。
 *   - 不使用 BIGINT；分类表是低频写入的字典，规模小，按 sort + code 排序即可。
 */
export const crmProductCategory = mysqlTable(
  'crm_product_category',
  {
    id: int().primaryKey().autoincrement().notNull(),
    code: varchar({ length: 64 }).notNull(),
    name: varchar({ length: 100 }).notNull(),
    parentCode: varchar('parent_code', { length: 64 }),
    sort: int().notNull().default(0),
    enabled: tinyint().notNull().default(1),
    createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
    updatedAt: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
    deletedAt: datetime('deleted_at'),
  },
  (t) => ({
    uniqCode: uniqueIndex('uniq_crm_product_category_code').on(t.code),
    idxParentCode: index('idx_crm_product_category_parent_code').on(t.parentCode),
    idxDeletedAt: index('idx_crm_product_category_deleted_at').on(t.deletedAt),
    idxEnabled: index('idx_crm_product_category_enabled').on(t.enabled),
  }),
)

/**
 * 计量单位（小字典表，code 唯一）。
 *
 * 报价/商机 item 行引用 crm_unit.code；报价快照同时记录 unitSnapshot。
 * 标准做法是把单位做成字典而不是 enum，因为业务会持续扩展自定义单位。
 */
export const crmUnit = mysqlTable(
  'crm_unit',
  {
    id: int().primaryKey().autoincrement().notNull(),
    code: varchar({ length: 64 }).notNull(),
    name: varchar({ length: 64 }).notNull(),
    sort: int().notNull().default(0),
    enabled: tinyint().notNull().default(1),
    createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
    updatedAt: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
    deletedAt: datetime('deleted_at'),
  },
  (t) => ({
    uniqCode: uniqueIndex('uniq_crm_unit_code').on(t.code),
    idxDeletedAt: index('idx_crm_unit_deleted_at').on(t.deletedAt),
    idxEnabled: index('idx_crm_unit_enabled').on(t.enabled),
  }),
)

/**
 * 产品主表（Phase 2 产品目录）。
 *
 * 设计要点：
 *   - 金额字段：standard_price_cents / amount_cents 使用 bigint({ mode: 'number' })，
 *     与 utils/money 的约定一致；JS 端用 safe integer cents 表达，详情见 utils/money.ts。
 *   - 税率字段：tax_rate_bp 用基点（basis points），1300 = 13%，
 *     避免 JS number 浮点；与 utils/money.computeLineAmountCents 的 taxRateBp 同源。
 *   - code 唯一：被 crm_quotation_item.product_code 外键引用。
 *   - 引用 crm_product_category.code / crm_unit.code：这里不再建外键约束，由 service 层负责。
 *   - 软删除：deleted_at；报价快照依然保留 nameSnapshot / unitSnapshot / unitPriceSnapshot / taxRateSnapshot，
 *     删除产品不会破坏已存在的报价历史。
 */
export const crmProduct = mysqlTable(
  'crm_product',
  {
    id: int().primaryKey().autoincrement().notNull(),
    code: varchar({ length: 64 }).notNull(),
    name: varchar({ length: 200 }).notNull(),
    categoryCode: varchar('category_code', { length: 64 }),
    unitCode: varchar('unit_code', { length: 64 }),
    standardPriceCents: bigint('standard_price_cents', { mode: 'number' }).notNull().default(0),
    taxRateBp: int('tax_rate_bp').notNull().default(0),
    enabled: tinyint().notNull().default(1),
    description: varchar({ length: 2000 }),
    creatorId: int('creator_id'),
    createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
    updaterId: int('updater_id'),
    updatedAt: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
    deletedAt: datetime('deleted_at'),
  },
  (t) => ({
    uniqCode: uniqueIndex('uniq_crm_product_code').on(t.code),
    idxName: index('idx_crm_product_name').on(t.name),
    idxCategoryCode: index('idx_crm_product_category_code').on(t.categoryCode),
    idxUnitCode: index('idx_crm_product_unit_code').on(t.unitCode),
    idxEnabled: index('idx_crm_product_enabled').on(t.enabled),
    idxDeletedAt: index('idx_crm_product_deleted_at').on(t.deletedAt),
  }),
)

/**
 * Phase 4 引入：工单表。
 *
 * 注意：**不挂任何业务路由**。表保留供 Phase 5 P1 使用；
 * 任何对它的引用都会因为没有 route + service 而编译期报错（防止误用）。
 */
export const crmTicket = mysqlTable(
  'crm_ticket',
  {
    id: int().primaryKey().autoincrement().notNull(),
    ticketNo: varchar('ticket_no', { length: 32 }).notNull(),
    title: varchar({ length: 200 }).notNull(),
    customerId: int('customer_id').notNull(),
    contactId: int('contact_id'),
    contractId: int('contract_id'),
    productId: int('product_id'),
    typeCode: varchar('type_code', { length: 64 }).notNull(),
    priorityCode: varchar('priority_code', { length: 64 }).notNull(),
    status: varchar({ length: 32 }).notNull().default('open'),
    ownerUserId: int('owner_user_id'),
    slaDueAt: datetime('sla_due_at'),
    description: varchar({ length: 2000 }),
    solution: varchar({ length: 2000 }),
    creatorId: int('creator_id'),
    createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
    updaterId: int('updater_id'),
    updatedAt: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
    closedAt: datetime('closed_at'),
    deletedAt: datetime('deleted_at'),
  },
  (t) => ({
    uniqTicketNo: uniqueIndex('uniq_crm_ticket_no').on(t.ticketNo),
    idxCustomer: index('idx_crm_ticket_customer_id').on(t.customerId),
    idxOwner: index('idx_crm_ticket_owner_user_id').on(t.ownerUserId),
    idxStatus: index('idx_crm_ticket_status').on(t.status),
    idxTypeCode: index('idx_crm_ticket_type_code').on(t.typeCode),
    idxPriorityCode: index('idx_crm_ticket_priority_code').on(t.priorityCode),
    idxDeletedAt: index('idx_crm_ticket_deleted_at').on(t.deletedAt),
  }),
)

/**
 * Phase 2 引入：报价单主表。
 *
 * 状态机（service 层强制）：
 *   draft → sent
 *   sent → accepted | rejected | voided
 *   accepted 不可变；同一 opportunity 下被新版 accepted 覆盖的旧版置为 superseded
 *
 * 金额三列（netCents / taxCents / totalCents）：
 *   - netCents  = sum(item.unitPriceCents × qty × (1 - discountBp/10000))   税前
 *   - taxCents  = sum(item.unitPriceCents × qty × (1 - discountBp/10000) × taxRateBp/10000)   税额
 *   - totalCents = netCents + taxCents
 * 列使用 bigint({ mode: 'number' })，与 utils/money 的约定一致。
 *
 * 软删除：deletedAt；已 sent/accepted 的报价不允许软删（在 service 层守卫）。
 */
export const crmQuotation = mysqlTable(
  'crm_quotation',
  {
    id: int().primaryKey().autoincrement().notNull(),
    /**
     * 报价单号：业务可见的单号。
     * 全局唯一（uniq_crm_quotation_no）；由 service 层按规则生成（见 QuotationService.genQuotationNo）。
     */
    quotationNo: varchar('quotation_no', { length: 32 }).notNull(),
    /**
     * 版本号：同一 opportunity 下的版本计数，从 1 开始递增。
     * acceptance 时把同 opportunity 下旧 accepted 置为 superseded（version 不变，只改 status）。
     */
    version: int().notNull().default(1),
    customerId: int('customer_id').notNull(),
    /**
     * 商机 id：Phase 2 暂存 nullable；Phase 3 Opportunity 上线后开始填充。
     */
    opportunityId: int('opportunity_id'),
    contactId: int('contact_id'),
    ownerUserId: int('owner_user_id').notNull(),
    /**
     * status ∈ { draft, sent, accepted, rejected, voided, superseded }
     * 详见 quotation.schema.ts 的 QUOTATION_STATUS 常量。
     */
    status: varchar({ length: 16 }).notNull().default('draft'),
    validUntil: datetime('valid_until'),
    netCents: bigint('net_cents', { mode: 'number' }).notNull().default(0),
    taxCents: bigint('tax_cents', { mode: 'number' }).notNull().default(0),
    totalCents: bigint('total_cents', { mode: 'number' }).notNull().default(0),
    remark: varchar({ length: 2000 }),
    creatorId: int('creator_id'),
    createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
    updaterId: int('updater_id'),
    updatedAt: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
    /**
     * 发送时间（draft → sent 时写入）。前端可在列表展示。
     */
    sentAt: datetime('sent_at'),
    /**
     * 接受时间（sent → accepted 时写入）。
     */
    acceptedAt: datetime('accepted_at'),
    /**
     * 作废/拒绝时间。
     */
    closedAt: datetime('closed_at'),
    deletedAt: datetime('deleted_at'),
  },
  (t) => ({
    uniqQuotationNo: uniqueIndex('uniq_crm_quotation_no').on(t.quotationNo),
    idxCustomer: index('idx_crm_quotation_customer_id').on(t.customerId),
    idxOpportunity: index('idx_crm_quotation_opportunity_id').on(t.opportunityId),
    idxContact: index('idx_crm_quotation_contact_id').on(t.contactId),
    idxOwner: index('idx_crm_quotation_owner_user_id').on(t.ownerUserId),
    idxStatus: index('idx_crm_quotation_status').on(t.status),
    idxOpportunityStatus: index('idx_crm_quotation_opportunity_status').on(t.opportunityId, t.status),
    idxCustomerStatus: index('idx_crm_quotation_customer_status').on(t.customerId, t.status),
    idxCreatedAt: index('idx_crm_quotation_created_at').on(t.createdAt),
    idxValidUntil: index('idx_crm_quotation_valid_until').on(t.validUntil),
    idxDeletedAt: index('idx_crm_quotation_deleted_at').on(t.deletedAt),
  }),
)

/**
 * 报价单明细行。
 *
 * 报价发出（sent）后明细行冻结：item 行只在 draft 阶段可改；
 * 每次重新生成 draft 都整体替换 item 集合（quotation_item 不保留历史）。
 *
 * 金额约定与主表一致：
 *   - quantityCents: INT，存 ×10000 的 4 位小数精度（12.3456 件 → 123456）
 *   - unitPriceCents / lineAmountCents: BIGINT，cents
 *   - discountBp / taxRateBp: INT，基点（1300 = 13%）
 *
 * 快照字段（productNameSnapshot / unitSnapshot）：发出报价时即使产品被改名/删除，列表仍展示历史值。
 */
export const crmQuotationItem = mysqlTable(
  'crm_quotation_item',
  {
    id: int().primaryKey().autoincrement().notNull(),
    quotationId: int('quotation_id').notNull(),
    /**
     * 产品 id（crm_product.id）。删除产品不级联删除 item 行；service 层负责按需读快照展示。
     */
    productId: int('product_id').notNull(),
    productNameSnapshot: varchar('product_name_snapshot', { length: 200 }).notNull(),
    unitSnapshot: varchar('unit_snapshot', { length: 64 }),
    quantityCents: int('quantity_cents').notNull().default(0),
    unitPriceCents: bigint('unit_price_cents', { mode: 'number' }).notNull().default(0),
    discountBp: int('discount_bp').notNull().default(0),
    taxRateBp: int('tax_rate_bp').notNull().default(0),
    lineAmountCents: bigint('line_amount_cents', { mode: 'number' }).notNull().default(0),
    /**
     * 同 item 在主表里的顺序，便于前端展示与 diff。
     */
    sortOrder: int('sort_order').notNull().default(0),
    createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
    updatedAt: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  },
  (t) => ({
    idxQuotation: index('idx_crm_quotation_item_quotation_id').on(t.quotationId),
    idxProduct: index('idx_crm_quotation_item_product_id').on(t.productId),
    idxQuotationSort: index('idx_crm_quotation_item_quotation_sort').on(t.quotationId, t.sortOrder),
  }),
)

/**
 * 报价单状态变更审计。
 *
 * 每次状态机迁移（draft → sent, sent → accepted/rejected/voided, 接受后旧版 superseded）
 * 都写一行；UI 在「报价详情/审计时间线」展示。
 *
 * fromStatus / toStatus 都是 quotation status 字符串；operatorUserId 来自 currentUser；
 * reason 是可选的人工备注（如 "客户要求终止"）。
 */
export const crmQuotationStatusLog = mysqlTable(
  'crm_quotation_status_log',
  {
    id: int().primaryKey().autoincrement().notNull(),
    quotationId: int('quotation_id').notNull(),
    fromStatus: varchar('from_status', { length: 16 }).notNull(),
    toStatus: varchar('to_status', { length: 16 }).notNull(),
    operatorUserId: int('operator_user_id').notNull(),
    reason: varchar({ length: 500 }),
    createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  },
  (t) => ({
    idxQuotation: index('idx_crm_quotation_status_log_quotation_id').on(t.quotationId),
    idxCreatedAt: index('idx_crm_quotation_status_log_created_at').on(t.createdAt),
    idxQuotationCreated: index('idx_crm_quotation_status_log_quotation_created').on(t.quotationId, t.createdAt),
  }),
)

/**
 * Phase 2 引入：商机（Opportunity）。
 *
 * 实体关系：
 *   - crm_opportunity ↔ crm_customer：必填（customerId NOT NULL）
 *   - crm_opportunity ↔ crm_contact：可选（contactId NULLABLE）
 *   - crm_opportunity ↔ crm_activity：polymorphic（entity_type='opportunity'）
 *   - crm_opportunity_stage_log ↔ crm_opportunity：阶段流转审计
 *
 * 设计要点：
 *   - stageCode 形如 "discover"/"qualify"/"proposal"/"negotiation"/"won"/"lost"，
 *     联合 unique constraint 留待 Phase 3 由 sys_enum(type='crm_opportunity_stage') 接管。
 *     当前 schema 层不强制 unique，service 层用 STAGE_TRANSITIONS 做合法性兜底。
 *   - pipelineCode 形如 "default" / "enterprise" 等，由 Phase 3 引入 sys_enum 后接管；
 *     当前与 stageCode 一起组成 (pipeline, stage) 联合索引，支撑 Kanban 按 pipeline 聚合。
 *   - expected_amount_cents: BIGINT（cents），与 utils/money 约定一致；
 *     JS 端 safe-integer cents 计算，不引入浮点。
 *   - won_at / lost_at 是终态时间戳；stageEnteredAt 是「进入当前阶段」的时间，
 *     服务层在 stage 切换时刷新。
 *   - version 是乐观锁字段（int）；每次 update 自增，避免并发覆盖丢失。
 *   - soft_delete：deleted_at；service 层在 update/list/transition 时统一过滤。
 */
export const crmOpportunity = mysqlTable(
  'crm_opportunity',
  {
    id: int().primaryKey().autoincrement().notNull(),
    name: varchar({ length: 200 }).notNull(),
    customerId: int('customer_id').notNull(),
    contactId: int('contact_id'),
    ownerUserId: int('owner_user_id'),
    ownerDepartmentId: int('owner_department_id'),
    pipelineCode: varchar('pipeline_code', { length: 64 }).notNull().default('default'),
    stageCode: varchar('stage_code', { length: 64 }).notNull().default('discover'),
    stageEnteredAt: datetime('stage_entered_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
    expectedAmountCents: bigint('expected_amount_cents', { mode: 'number' }).notNull().default(0),
    expectedCloseDate: datetime('expected_close_date'),
    nextActionAt: datetime('next_action_at'),
    lostReasonCode: varchar('lost_reason_code', { length: 64 }),
    wonAt: datetime('won_at'),
    lostAt: datetime('lost_at'),
    /**
     * 乐观锁：每次 update 自增 1。service 层在事务内读取旧 version，
     * update 时 where id=? AND version=? + set version=version+1。
     */
    version: int().notNull().default(1),
    creatorId: int('creator_id'),
    createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
    updaterId: int('updater_id'),
    updatedAt: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
    deletedAt: datetime('deleted_at'),
  },
  (t) => ({
    idxCustomer: index('idx_crm_opportunity_customer_id').on(t.customerId),
    idxContact: index('idx_crm_opportunity_contact_id').on(t.contactId),
    idxOwnerStage: index('idx_crm_opportunity_owner_stage').on(t.ownerUserId, t.stageCode),
    idxCustomerStage: index('idx_crm_opportunity_customer_stage').on(t.customerId, t.stageCode),
    idxPipelineStage: index('idx_crm_opportunity_pipeline_stage').on(t.pipelineCode, t.stageCode),
    idxPipelineStageEntered: index('idx_crm_opportunity_pipeline_stage_entered').on(
      t.pipelineCode,
      t.stageCode,
      t.stageEnteredAt,
    ),
    idxStage: index('idx_crm_opportunity_stage').on(t.stageCode),
    idxNextAction: index('idx_crm_opportunity_next_action_at').on(t.nextActionAt),
    idxDeletedAt: index('idx_crm_opportunity_deleted_at').on(t.deletedAt),
    idxCreatedAt: index('idx_crm_opportunity_created_at').on(t.createdAt),
  }),
)

/**
 * 商机阶段流转审计。
 *
 * 每次 advanceStage / rollBackStage / markWon / markLost 都必须写一行；
 * entity_type='opportunity' 的 crm_activity 由 service 同步双写。
 *
 * fromStage / toStage 都是 opportunity stageCode 字符串；
 * operatorUserId 来自 currentUser；reason 可选（如"客户改期"）。
 */
export const crmOpportunityStageLog = mysqlTable(
  'crm_opportunity_stage_log',
  {
    id: int().primaryKey().autoincrement().notNull(),
    opportunityId: int('opportunity_id').notNull(),
    fromStage: varchar('from_stage', { length: 64 }).notNull(),
    toStage: varchar('to_stage', { length: 64 }).notNull(),
    operatorUserId: int('operator_user_id').notNull(),
    reason: varchar({ length: 500 }),
    createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  },
  (t) => ({
    idxOpportunity: index('idx_crm_opportunity_stage_log_opportunity_id').on(t.opportunityId),
    idxCreatedAt: index('idx_crm_opportunity_stage_log_created_at').on(t.createdAt),
    idxOpportunityCreated: index('idx_crm_opportunity_stage_log_opportunity_created').on(
      t.opportunityId,
      t.createdAt,
    ),
  }),
)

/* =============================================================================
 * Phase 3: 合同 + 回款
 * ============================================================================= */

/**
 * Phase 3 合同主表。
 *
 * 创建入口：ContractService.createFromAcceptedQuotation(quotationId)。
 * 状态机：draft → pending → active → completed / voided。
 * 履约中金额变更：不允许直接改 amountCents；走 crm_activity(type='contract_status_change') 审计。
 */
export const crmContract = mysqlTable(
  'crm_contract',
  {
    id: int().primaryKey().autoincrement().notNull(),
    contractNo: varchar('contract_no', { length: 32 }).notNull(),
    name: varchar({ length: 200 }).notNull(),
    customerId: int('customer_id').notNull(),
    opportunityId: int('opportunity_id'),
    quotationId: int('quotation_id'),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull().default(0),
    signedAt: datetime('signed_at'),
    effectiveAt: datetime('effective_at'),
    expiresAt: datetime('expires_at'),
    status: varchar({ length: 32 }).notNull().default('draft'),
    ownerUserId: int('owner_user_id'),
    ownerDepartmentId: int('owner_department_id'),
    /** 附件 ID 列表（json 数组存储）；附件走 sys_attachment。 */
    attachmentIds: json('attachment_ids'),
    description: varchar({ length: 2000 }),
    creatorId: int('creator_id'),
    createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
    updaterId: int('updater_id'),
    updatedAt: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
    deletedAt: datetime('deleted_at'),
  },
  (t) => ({
    uniqContractNo: uniqueIndex('uniq_crm_contract_no').on(t.contractNo),
    idxCustomer: index('idx_crm_contract_customer_id').on(t.customerId),
    idxOpportunity: index('idx_crm_contract_opportunity_id').on(t.opportunityId),
    idxQuotation: index('idx_crm_contract_quotation_id').on(t.quotationId),
    idxOwner: index('idx_crm_contract_owner_user_id').on(t.ownerUserId),
    idxStatus: index('idx_crm_contract_status').on(t.status),
    idxCustomerStatus: index('idx_crm_contract_customer_status').on(t.customerId, t.status),
    idxDeletedAt: index('idx_crm_contract_deleted_at').on(t.deletedAt),
  }),
)

/**
 * Phase 3 回款计划。
 *
 * 计划合计 ≤ 合同金额（DB check + service 校验双层）。
 * status 由 computePaymentPlanStatus 计算（pending / partial / paid / overdue）；
 * 不会在写入时设值，由定时 job 重算。
 */
export const crmPaymentPlan = mysqlTable(
  'crm_payment_plan',
  {
    id: int().primaryKey().autoincrement().notNull(),
    contractId: int('contract_id').notNull(),
    periodNo: int('period_no').notNull(),
    plannedDate: datetime('planned_date').notNull(),
    plannedAmountCents: bigint('planned_amount_cents', { mode: 'number' }).notNull().default(0),
    /** 由 job 写入；不在 service 写入路径出现。 */
    status: varchar({ length: 16 }).notNull().default('pending'),
    remark: varchar({ length: 500 }),
    creatorId: int('creator_id'),
    createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
    updaterId: int('updater_id'),
    updatedAt: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
    deletedAt: datetime('deleted_at'),
  },
  (t) => ({
    idxContract: index('idx_crm_payment_plan_contract_id').on(t.contractId),
    idxPlannedDate: index('idx_crm_payment_plan_planned_date').on(t.plannedDate),
    idxStatus: index('idx_crm_payment_plan_status').on(t.status),
    idxContractPeriod: uniqueIndex('uniq_crm_payment_plan_contract_period').on(t.contractId, t.periodNo),
    idxDeletedAt: index('idx_crm_payment_plan_deleted_at').on(t.deletedAt),
  }),
)

/**
 * Phase 3 实际回款。
 *
 * 不直接关联 plan —— 实际回款可分配到任意 plan，通过 crm_payment_writeoff 桥接。
 * 冲销：不允许物理删除，仅创建负向 writeoff + 审计活动。
 */
export const crmPaymentActual = mysqlTable(
  'crm_payment_actual',
  {
    id: int().primaryKey().autoincrement().notNull(),
    contractId: int('contract_id').notNull(),
    receivedAt: datetime('received_at').notNull(),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull().default(0),
    methodCode: varchar('method_code', { length: 64 }).notNull(),
    operatorUserId: int('operator_user_id').notNull(),
    remark: varchar({ length: 500 }),
    creatorId: int('creator_id'),
    createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
    updatedAt: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
    deletedAt: datetime('deleted_at'),
  },
  (t) => ({
    idxContract: index('idx_crm_payment_actual_contract_id').on(t.contractId),
    idxReceivedAt: index('idx_crm_payment_actual_received_at').on(t.receivedAt),
    idxMethodCode: index('idx_crm_payment_actual_method_code').on(t.methodCode),
    idxDeletedAt: index('idx_crm_payment_actual_deleted_at').on(t.deletedAt),
  }),
)

/**
 * Phase 3 核销桥接表。
 *
 * 多对多：actualId ↔ planId；amountCents 表示本次核销金额。
 * 同一个 actual 可以分摊到多个 plan（FIFO / 手动指定）。
 */
export const crmPaymentWriteoff = mysqlTable(
  'crm_payment_writeoff',
  {
    id: int().primaryKey().autoincrement().notNull(),
    actualId: int('actual_id').notNull(),
    planId: int('plan_id').notNull(),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull().default(0),
    operatorUserId: int('operator_user_id').notNull(),
    createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  },
  (t) => ({
    idxActual: index('idx_crm_payment_writeoff_actual_id').on(t.actualId),
    idxPlan: index('idx_crm_payment_writeoff_plan_id').on(t.planId),
    idxActualPlan: uniqueIndex('uniq_crm_payment_writeoff_actual_plan').on(t.actualId, t.planId),
  }),
)
