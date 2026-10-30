import { datetime, date, int, json, mysqlTable, text, varchar, uniqueIndex, index } from 'drizzle-orm/mysql-core'
import { sql } from 'drizzle-orm'
import { sysUser } from '@yishan/core-system-api/schema'

const timestamps = {
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
}

export const crmHospital = mysqlTable('crm_hospital', {
  // STRICT-SPEC §3.1：account_user_id NOT NULL + UNIQUE；FK 声明对齐 0003 迁移的物理外键。
  // Drizzle 不在生成列约束时强制外键，但 schema 与 SQL 一致是 §9.1 静态门禁要求。
  id: int().primaryKey().autoincrement().notNull(),
  accountUserId: int('account_user_id').notNull().references(() => sysUser.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
  hospitalName: varchar('hospital_name', { length: 50 }).notNull(), provinceId: int('province_id'), cityId: int('city_id'), districtId: int('district_id'), hospitalAddress: varchar('hospital_address', { length: 255 }), hospitalPhone: varchar('hospital_phone', { length: 50 }), hospitalSelling: varchar('hospital_selling', { length: 255 }), hospitalWebsite: varchar('hospital_website', { length: 255 }), hospitalNature: int('hospital_nature').notNull().default(-1), category: varchar('category', { length: 20 }), doctorName: varchar('doctor_name', { length: 50 }), doctorPhone: varchar('doctor_phone', { length: 50 }), doctorQq: varchar('doctor_qq', { length: 50 }), receptionName: varchar('reception_name', { length: 50 }), receptionPhone: varchar('reception_phone', { length: 50 }), receptionQq: varchar('reception_qq', { length: 50 }), busStation: varchar('bus_station', { length: 100 }), busAddress: varchar('bus_address', { length: 255 }), subwayStation: varchar('subway_station', { length: 100 }), subwayAddress: varchar('subway_address', { length: 255 }), taxiFare: varchar('taxi_fare', { length: 50 }), vipDiscount: varchar('vip_discount', { length: 255 }), returnPoint: varchar('return_point', { length: 50 }), hospitalIntroduction: text('hospital_introduction'), contractPhotos: json('contract_photos'), wechatOpenid: varchar('wechat_openid', { length: 64 }), status: int().notNull().default(1), creatorId: int('creator_id').notNull(), ...timestamps, updaterId: int('updater_id').notNull(), deletedAt: datetime('deleted_at', { mode: 'date' }), version: int().notNull().default(1),
  // category 字段：'oral' 口腔 / 'plastic' 整形 / NULL 视为 dashboard 派生 'unknown'。
  // 由 drizzle 0003 迁移添加；写入由 CrmHospitalFieldsSchema 校验为 'oral' | 'plastic'。
}, (t) => [uniqueIndex('uniq_crm_hospital_account_user').on(t.accountUserId), uniqueIndex('uniq_crm_hospital_name').on(t.hospitalName), index('idx_crm_hospital_region').on(t.provinceId,t.cityId,t.districtId), index('idx_crm_hospital_status').on(t.status), index('idx_crm_hospital_deleted_at').on(t.deletedAt)])

export const crmCustomerStatus = mysqlTable('crm_customer_status', { id: int().primaryKey().autoincrement().notNull(), name: varchar({ length: 50 }).notNull(), sortOrder: int('sort_order').notNull().default(0), status: int().notNull().default(1), ...timestamps }, (t) => [uniqueIndex('uniq_crm_customer_status_name').on(t.name), index('idx_crm_customer_status').on(t.status,t.sortOrder)])
export const crmCustomer = mysqlTable('crm_customer', { id: int().primaryKey().autoincrement().notNull(), numberId: varchar('number_id', { length: 20 }).notNull(), name: varchar({ length: 50 }).notNull(), gender: int().notNull().default(0), birthday: date('birthday', { mode: 'date' }), telphone: varchar({ length: 20 }), mobile: varchar({ length: 20 }), qq: varchar({ length: 20 }), wechat: varchar({ length: 50 }), provinceId: int('province_id'), cityId: int('city_id'), districtId: int('district_id'), address: varchar({ length: 255 }), plastic: varchar({ length: 255 }), statusId: int('status_id').notNull(), remark: text(), ownerUserId: int('owner_user_id').notNull(), creatorId: int('creator_id').notNull(), ...timestamps, updaterId: int('updater_id').notNull(), deletedAt: datetime('deleted_at', { mode: 'date' }), version: int().notNull().default(1) }, (t) => [uniqueIndex('uniq_crm_customer_number_id').on(t.numberId), index('idx_crm_customer_owner').on(t.ownerUserId), index('idx_crm_customer_status').on(t.statusId), index('idx_crm_customer_mobile').on(t.mobile), index('idx_crm_customer_created').on(t.createdAt), index('idx_crm_customer_deleted_at').on(t.deletedAt)])
export const crmCustomerRemark = mysqlTable('crm_customer_remark', { id: int().primaryKey().autoincrement().notNull(), customerId: int('customer_id').notNull(), userId: int('user_id').notNull(), content: text().notNull(), createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`) }, (t) => [index('idx_crm_customer_remark_customer').on(t.customerId), index('idx_crm_customer_remark_user').on(t.userId)])
export const crmCustomerBrowse = mysqlTable('crm_customer_browse', { id: int().primaryKey().autoincrement().notNull(), customerId: int('customer_id').notNull(), userId: int('user_id').notNull(), action: varchar({ length: 20 }).notNull().default('view'), createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`) }, (t) => [index('idx_crm_customer_browse_customer').on(t.customerId), index('idx_crm_customer_browse_user').on(t.userId)])
export const crmDispatchStatus = mysqlTable('crm_dispatch_status', { id: int().primaryKey().autoincrement().notNull(), name: varchar({ length: 50 }).notNull(), sortOrder: int('sort_order').notNull().default(0), status: int().notNull().default(1), ...timestamps }, (t) => [uniqueIndex('uniq_crm_dispatch_status_name').on(t.name), index('idx_crm_dispatch_status').on(t.status,t.sortOrder)])
export const crmDispatch = mysqlTable('crm_dispatch', { id: int().primaryKey().autoincrement().notNull(), customerId: int('customer_id').notNull(), hospitalId: int('hospital_id').notNull(), statusId: int('status_id').notNull(), image: varchar({ length: 500 }), receiveQq: varchar('receive_qq', { length: 50 }), receiveWechat: varchar('receive_wechat', { length: 50 }), finishedAt: datetime('finished_at', { mode: 'date' }), creatorId: int('creator_id').notNull(), ...timestamps, updaterId: int('updater_id').notNull(), deletedAt: datetime('deleted_at', { mode: 'date' }), version: int().notNull().default(1) }, (t) => [index('idx_crm_dispatch_customer').on(t.customerId), index('idx_crm_dispatch_hospital').on(t.hospitalId), index('idx_crm_dispatch_status').on(t.statusId), index('idx_crm_dispatch_created').on(t.createdAt), index('idx_crm_dispatch_deleted_at').on(t.deletedAt)])
export const crmDispatchReply = mysqlTable('crm_dispatch_reply', { id: int().primaryKey().autoincrement().notNull(), dispatchId: int('dispatch_id').notNull(), userId: int('user_id').notNull(), content: text().notNull(), createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`) }, (t) => [index('idx_crm_dispatch_reply_dispatch').on(t.dispatchId), index('idx_crm_dispatch_reply_user').on(t.userId)])
export const crmDispatchFollowLog = mysqlTable('crm_dispatch_follow_log', { id: int().primaryKey().autoincrement().notNull(), dispatchId: int('dispatch_id').notNull(), userId: int('user_id').notNull(), content: text().notNull(), createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`) }, (t) => [index('idx_crm_dispatch_log_dispatch').on(t.dispatchId), index('idx_crm_dispatch_log_user').on(t.userId)])

/**
 * 派单客户手机号查看日志
 *
 * 设计目标：医院账号在派单列表/详情中默认看到的是脱敏后的手机号（138****1234），
 * 点击眼睛图标才看到明文。该动作会被记录到本表，super_admin 可在派单详情查看
 * 「谁在何时查看了哪个派单的客户手机号」。
 *
 * 字段约定：
 * - viewer_user_id + viewer_username 冗余记录，方便审计时直接看到人
 * - viewer_hospital_name 仅当查看人是医院账号时有值
 * - ip_address 来自 req.ip，便于事后排查
 */
export const crmDispatchMobileViewLog = mysqlTable('crm_dispatch_mobile_view_log', {
  id: int().primaryKey().autoincrement().notNull(),
  dispatchId: int('dispatch_id').notNull(),
  viewerUserId: int('viewer_user_id').notNull(),
  viewerUsername: varchar('viewer_username', { length: 100 }).notNull(),
  viewerHospitalName: varchar('viewer_hospital_name', { length: 100 }),
  ipAddress: varchar('ip_address', { length: 64 }),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
}, (t) => [
  index('idx_crm_dispatch_mvlog_dispatch').on(t.dispatchId),
  index('idx_crm_dispatch_mvlog_user').on(t.viewerUserId),
  index('idx_crm_dispatch_mvlog_created').on(t.createdAt),
])

/**
 * 派单「医院查看」留痕日志。
 *
 * 设计目标：医院账号首次打开派单详情时自动写一条。
 * UNIQUE (dispatch_id, hospital_id, viewer_user_id) 兜底幂等。
 * hospital_id 冗余避免派单改派后失去归属链。
 */
export const crmDispatchViewLog = mysqlTable('crm_dispatch_view_log', {
  id: int().primaryKey().autoincrement().notNull(),
  dispatchId: int('dispatch_id').notNull(),
  hospitalId: int('hospital_id').notNull(),
  viewerUserId: int('viewer_user_id').notNull(),
  viewerUsername: varchar('viewer_username', { length: 100 }).notNull(),
  viewerHospitalName: varchar('viewer_hospital_name', { length: 100 }),
  ipAddress: varchar('ip_address', { length: 64 }),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
}, (t) => [
  uniqueIndex('uniq_crm_dispatch_view_log_dispatch_hospital_user')
    .on(t.dispatchId, t.hospitalId, t.viewerUserId),
  index('idx_crm_dispatch_view_log_dispatch').on(t.dispatchId),
  index('idx_crm_dispatch_view_log_hospital').on(t.hospitalId),
  index('idx_crm_dispatch_view_log_created').on(t.createdAt),
])

// ──────────────────────────────────────────────
// 会员顾客模块 (enhanced)
// ──────────────────────────────────────────────

/** 会员主表 — 关联 crm_customer(customerId) 或直接新增 */
export const crmMemberCustomer = mysqlTable('crm_member_customer', {
  id: int().primaryKey().autoincrement().notNull(),
  numberId: varchar('number_id', { length: 20 }).notNull(),
  customerId: int('customer_id'),
  // 基本资料（当 customerId 不为空时从 crm_customer 同步；直接新增时独立存储）
  name: varchar({ length: 50 }).notNull(),
  gender: int().notNull().default(0),
  birthday: date('birthday', { mode: 'date' }),
  mobile: varchar({ length: 20 }),
  wechat: varchar({ length: 50 }),
  qq: varchar({ length: 20 }),
  address: varchar({ length: 255 }),
  provinceId: int('province_id'),
  cityId: int('city_id'),
  districtId: int('district_id'),
  // 来源: 'from_customer' | 'direct'
  source: varchar({ length: 20 }).notNull().default('from_customer'),
  // 会员业务信息
  businessCategory: varchar('business_category', { length: 50 }),
  intentionProject: varchar('intention_project', { length: 255 }),
  memberStage: varchar('member_stage', { length: 30 }).notNull().default('new'),
  intentionLevel: varchar('intention_level', { length: 20 }).notNull().default('unset'),
  budgetRange: varchar('budget_range', { length: 50 }),
  expectedDate: date('expected_date', { mode: 'date' }),
  preferredHospitalId: int('preferred_hospital_id'),
  // 状态控制
  memberStatus: varchar('member_status', { length: 20 }).notNull().default('active'), // 'active' | 'invalid'
  joinedAt: datetime('joined_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  invalidAt: datetime('invalid_at', { mode: 'date' }),
  invalidBy: int('invalid_by'),
  previousStage: varchar('previous_stage', { length: 30 }),
  // 跟进相关
  lastFollowUpAt: datetime('last_follow_up_at', { mode: 'date' }),
  nextFollowUpAt: datetime('next_follow_up_at', { mode: 'date' }),
  // 归属
  ownerUserId: int('owner_user_id').notNull(),
  // 备注
  remark: text(),
  // 审计
  creatorId: int('creator_id').notNull(),
  ...timestamps,
  updaterId: int('updater_id').notNull(),
  deletedAt: datetime('deleted_at', { mode: 'date' }),
  version: int().notNull().default(1),
}, (t) => [
  uniqueIndex('uniq_crm_member_number_id').on(t.numberId),
  uniqueIndex('uniq_crm_member_customer_id').on(t.customerId),
  index('idx_crm_member_owner').on(t.ownerUserId),
  index('idx_crm_member_mobile').on(t.mobile),
  index('idx_crm_member_stage').on(t.memberStage),
  index('idx_crm_member_status').on(t.memberStatus),
  index('idx_crm_member_created').on(t.createdAt),
  index('idx_crm_member_deleted_at').on(t.deletedAt),
])

export const crmMemberRemark = mysqlTable('crm_member_remark', { id: int().primaryKey().autoincrement().notNull(), memberId: int('member_id').notNull(), userId: int('user_id').notNull(), content: text().notNull(), createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`) }, (t) => [index('idx_crm_member_remark_member').on(t.memberId), index('idx_crm_member_remark_user').on(t.userId)])
export const crmMemberBrowse = mysqlTable('crm_member_browse', { id: int().primaryKey().autoincrement().notNull(), memberId: int('member_id').notNull(), userId: int('user_id').notNull(), action: varchar({ length: 20 }).notNull().default('view'), createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`) }, (t) => [index('idx_crm_member_browse_member').on(t.memberId), index('idx_crm_member_browse_user').on(t.userId)])

/** 会员标签定义 */
export const crmMemberTag = mysqlTable('crm_member_tag', {
  id: int().primaryKey().autoincrement().notNull(),
  name: varchar({ length: 50 }).notNull(),
  color: varchar({ length: 20 }),
  status: int().notNull().default(1),
  creatorId: int('creator_id').notNull(),
  ...timestamps,
  deletedAt: datetime('deleted_at', { mode: 'date' }),
}, (t) => [uniqueIndex('uniq_crm_member_tag_name').on(t.name)])

/** 会员-标签 N:M 关系 */
export const crmMemberTagRelation = mysqlTable('crm_member_tag_relation', {
  id: int().primaryKey().autoincrement().notNull(),
  memberId: int('member_id').notNull(),
  tagId: int('tag_id').notNull(),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
}, (t) => [
  uniqueIndex('uniq_crm_member_tag_rel').on(t.memberId, t.tagId),
  index('idx_crm_member_tag_rel_member').on(t.memberId),
  index('idx_crm_member_tag_rel_tag').on(t.tagId),
])

/** 跟进记录 */
export const crmFollowUpRecord = mysqlTable('crm_follow_up_record', {
  id: int().primaryKey().autoincrement().notNull(),
  memberId: int('member_id').notNull(),
  operatorUserId: int('operator_user_id').notNull(),
  followUpMethod: varchar('follow_up_method', { length: 20 }),
  content: text().notNull(),
  result: varchar({ length: 30 }),
  stageAfter: varchar('stage_after', { length: 30 }),
  intentionLevelAfter: varchar('intention_level_after', { length: 20 }),
  nextFollowUpAt: datetime('next_follow_up_at', { mode: 'date' }),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
}, (t) => [
  index('idx_crm_follow_up_member').on(t.memberId),
  index('idx_crm_follow_up_created').on(t.createdAt),
])

/** 会员转交历史 */
export const crmMemberAssignmentHistory = mysqlTable('crm_member_assignment_history', {
  id: int().primaryKey().autoincrement().notNull(),
  memberId: int('member_id').notNull(),
  fromUserId: int('from_user_id'),
  toUserId: int('to_user_id').notNull(),
  operatorUserId: int('operator_user_id').notNull(),
  reason: varchar({ length: 255 }),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
}, (t) => [
  index('idx_crm_member_assign_member').on(t.memberId),
  index('idx_crm_member_assign_created').on(t.createdAt),
])

// STRICT-SPEC §3.1.6：crm_hospital_account 表已物理删除；Drizzle 定义与所有索引同步移除。
// 一院一账号由 crm_hospital.account_user_id 唯一定位，禁止重新引入该表。
