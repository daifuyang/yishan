import { sql } from 'drizzle-orm'
import { bigint, check, datetime, index, int, json, mysqlTable, uniqueIndex, varchar } from 'drizzle-orm/mysql-core'
import type { ChatMessage } from '../schemas/ai-chat.schema.js'
import type { ActionDraftStatus } from '../schemas/action-draft.schema.js'

export const aiModelSettings = mysqlTable('ai_model_settings', {
  id: int().primaryKey(),
  baseUrl: varchar('base_url', { length: 2048 }).notNull(),
  model: varchar({ length: 255 }).notNull(),
  apiKey: varchar('api_key', { length: 4096 }).notNull(),
  updatedBy: int('updated_by').notNull(),
  updatedAt: datetime('updated_at', { mode: 'date', fsp: 3 }).notNull(),
}, table => [check('ai_model_settings_singleton', sql`${table.id} = 1`)])

/**
 * AI 助手会话表。
 *
 * 命名约定：表名以 `<meta.id>_` 为前缀。本模块 meta.id = 'ai'，所以表名 = ai_conversations。
 *
 * active_owner / generation_token / lease_expires_at 共同实现「同一用户同一时刻
 * 只允许一个流式生成」的租约，避免多标签页重复占用同一条会话。
 */
export const aiConversations = mysqlTable('ai_conversations', {
  id: varchar({ length: 64 }).primaryKey(),
  ownerId: int('owner_id').notNull(),
  title: varchar({ length: 100 }).notNull(),
  activeOwner: int('active_owner'),
  generationToken: varchar('generation_token', { length: 64 }),
  leaseExpiresAt: datetime('lease_expires_at', { mode: 'date', fsp: 3 }),
  createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull(),
  updatedAt: datetime('updated_at', { mode: 'date', fsp: 3 }).notNull(),
}, table => [index('ai_conversations_owner_updated').on(table.ownerId, table.updatedAt), uniqueIndex('ai_conversations_active_owner').on(table.activeOwner)])

/** 单条会话的消息，按 position 保序；conversation_id 级联删除。 */
export const aiMessages = mysqlTable('ai_messages', {
  conversationId: varchar('conversation_id', { length: 64 }).notNull().references(() => aiConversations.id, { onDelete: 'cascade' }),
  id: varchar({ length: 64 }).notNull(),
  position: int().notNull(),
  message: json().$type<ChatMessage>().notNull(),
}, table => [uniqueIndex('ai_messages_conversation_id').on(table.conversationId, table.id), uniqueIndex('ai_messages_position').on(table.conversationId, table.position)])

/**
 * AI 能力执行审计。
 *
 * 系统自带的 `audit.ts` 插件只往 stdout 打日志（它自己在注释里写明了），不落库；
 * 这里必须是本模块自有的账本，否则「AI 替谁做了什么」永远查无实据。
 *
 * 敏感字段只存 `input_digest`（脱敏后的字段名摘要），不存原始入参原文——
 * 模型给的密码、口令一类东西不该因为审计而获得第二份副本。
 */
export const aiAudit = mysqlTable('ai_audit', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  requestId: varchar('request_id', { length: 64 }).notNull(),
  conversationId: varchar('conversation_id', { length: 64 }),
  actorId: int('actor_id').notNull(),
  sessionId: varchar('session_id', { length: 64 }),
  capabilityName: varchar('capability_name', { length: 64 }).notNull(),
  operationId: varchar('operation_id', { length: 64 }).notNull(),
  riskLevel: varchar('risk_level', { length: 16 }).notNull(),
  permissionDecision: varchar('permission_decision', { length: 16 }).notNull(),
  executionStatus: varchar('execution_status', { length: 16 }).notNull(),
  targetType: varchar('target_type', { length: 32 }),
  targetId: varchar('target_id', { length: 64 }),
  inputDigest: varchar('input_digest', { length: 512 }),
  errorSummary: varchar('error_summary', { length: 512 }),
  durationMs: int('duration_ms'),
  tokenUsage: json('token_usage').$type<{ inputTokens?: number; outputTokens?: number; totalTokens?: number }>(),
  createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
}, table => [
  index('ai_audit_actor_created').on(table.actorId, table.createdAt),
  index('ai_audit_capability_created').on(table.capabilityName, table.createdAt),
  index('ai_audit_request_id').on(table.requestId),
])

/**
 * AI 业务助手的**持久化草稿**（设计 §9）。
 *
 * 归属是「一个人 + 一个会话」：外键只保证会话存在，`owner_id` 与
 * `conversation_id` 的复合索引与 CAS 谓词负责归属判断。删会话时草稿随外键级联清理，
 * 而正在提交的草稿由 Service 在事务里先行拒绝删除（设计 §9）。
 *
 * 三条刻意保留在表上的约束：
 *
 * - `form_data` **只**存 Task 2 的非敏感字段（username/email/phone/realName/
 *   nickname/gender/birthDate/status/deptIds/roleIds）。`password` 没有列 ——
 *   草稿不是密码的第二份副本。唯一的自我保护是应用层白名单，不是「约定」。
 * - `result_ref` 只存业务结果的引用（target_type / target_id），**不存密码原文
 *   或派生摘要作为幂等键**（设计 §11）。幂等由 `(draft_id, draft_version)` 的
 *   事务 CAS 承担。
 * - `expires_at` 自创建起算且**不随编辑延长**；编辑只动 `updated_at`。
 */
export const aiActionDrafts = mysqlTable('ai_action_drafts', {
  draftId: varchar('draft_id', { length: 64 }).primaryKey(),
  ownerId: int('owner_id').notNull(),
  conversationId: varchar('conversation_id', { length: 64 }).notNull().references(() => aiConversations.id, { onDelete: 'cascade' }),
  module: varchar('module', { length: 32 }).notNull(),
  action: varchar('action', { length: 64 }).notNull(),
  schemaVersion: int('schema_version').notNull(),
  formData: json('form_data').$type<Record<string, unknown>>().notNull(),
  missingFields: json('missing_fields').$type<{ name: string; label: string; required: boolean; sensitive: boolean; mustCompleteInForm: boolean }[]>().notNull(),
  validationErrors: json('validation_errors').$type<{ field: string; label: string; code: string; message: string }[]>().notNull(),
  draftVersion: int('draft_version').notNull().default(1),
  status: varchar('status', { length: 16 }).$type<ActionDraftStatus>().notNull(),
  resultRef: json('result_ref').$type<{ targetType: string; targetId: string }>(),
  // 提交失败时的可读原因（设计 §11「保留可编辑草稿并给出明确错误」）。
  // 它是**业务**失败原因，不是密码、不是请求原文。
  failureReason: varchar('failure_reason', { length: 255 }),
  expiresAt: datetime('expires_at', { mode: 'date', fsp: 3 }).notNull(),
  createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull(),
  updatedAt: datetime('updated_at', { mode: 'date', fsp: 3 }).notNull(),
}, table => [
  // 归属查询（列表、归属判断）与 CAS 的前缀都从这里走。
  index('ai_action_drafts_owner_conversation').on(table.ownerId, table.conversationId, table.createdAt),
  index('ai_action_drafts_expires_at').on(table.expiresAt),
])
