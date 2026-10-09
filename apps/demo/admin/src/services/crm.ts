/**
 * CRM 前端 API 客户端（手工类型）。
 *
 * 由 `pnpm --filter yishan-admin openapi` 重新生成 services 后，
 * 这部分可以替换为 `import * as crm from '@/modules/crm/services/generated/crm'`。
 *
 * 这里先以手工类型 + request() 的方式暴露，避免后端未跑时阻塞前端开发。
 */

import { request } from '@umijs/max'
import { crmQuotationsCreate, crmQuotationsGet, crmQuotationsList, crmQuotationsUpdate, crmQuotationsVoid, crmQuotationsDelete, crmQuotationsRevise, crmQuotationsAccept, crmQuotationsRevokeConfirmation } from '@/modules/crm/services/generated/crm'
import type { CustomerStatusCode } from '@/modules/crm/domain/statuses'

/* ─── 通用包装 ────────────────────────────────────────── */

export interface ApiResp<T> {
  success: boolean
  code: number
  message: string
  data: T
  pagination?: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
  timestamp: string
}

export interface PageQuery {
  page?: number
  pageSize?: number
  keyword?: string
}

/* ─── 客户 ────────────────────────────────────────── */

export type CustomerType = 'enterprise' | 'individual'
export type PoolStatus = 'owned' | 'public'
export type CustomerListView = 'all' | 'important' | 'mine' | 'collaborating' | 'pending' | 'stale7d' | 'pool'
export type CustomerSortOrder = 'asc' | 'desc'
export type CustomerSortField = 'updatedAt' | 'nextFollowUpAt' | 'lastFollowUpAt' | 'createdAt' | 'name' | 'level'

export interface CustomerRow {
  ownerUserName?: string | null
  primaryContactId?: number | null
  primaryContactName?: string | null
  primaryContactMobile?: string | null
  id: number
  code: string | null
  name: string
  type: string
  statusCode: CustomerStatusCode | null
  sourceId: number | null
  level: string | null
  industry: string | null
  phone: string | null
  website: string | null
  province: string | null
  city: string | null
  address: string | null
  ownerUserId: number | null
  ownerDepartmentId: number | null
  poolStatus: string
  lastFollowUpAt: string | null
  nextFollowUpAt: string | null
  remark: string | null
  creatorId: number | null
  createdAt: string
  updaterId: number | null
  updatedAt: string
}

export interface CustomerDetail extends CustomerRow {
  tagIds: number[]
  ownerUserName: string | null
  statusName: string | null
  sourceName: string | null
  primaryContactId: number | null
  primaryContactName: string | null
  relationshipStatus?: CustomerStatusCode | null
}

export interface CustomerCreateInput {
  name: string
  type?: CustomerType
  statusCode?: CustomerStatusCode | null
  sourceId?: number | null
  level?: string | null
  industry?: string | null
  phone?: string | null
  website?: string | null
  province?: string | null
  city?: string | null
  address?: string | null
  ownerUserId?: number | null
  ownerDepartmentId?: number | null
  tagIds?: number[]
  remark?: string | null
}

export interface CustomerUpdateInput extends Partial<CustomerCreateInput> {}

export interface CustomerListQuery extends PageQuery {
  view?: CustomerListView
  statusCode?: CustomerStatusCode
  sourceId?: number
  level?: string
  type?: string
  industry?: string
  province?: string
  city?: string
  ownerUserId?: number
  poolStatus?: PoolStatus
  collaboratorId?: number
  tagIds?: number[]
  createdFrom?: string
  createdTo?: string
  lastFollowUpFrom?: string
  lastFollowUpTo?: string
  nextFollowUpFrom?: string
  nextFollowUpTo?: string
  sortBy?: CustomerSortField
  sortOrder?: CustomerSortOrder
}

/* ─── 联系人 ────────────────────────────────────────── */

export interface ContactRow {
  id: number
  customerId: number
  name: string
  gender: number
  mobile: string | null
  phone: string | null
  email: string | null
  department: string | null
  position: string | null
  isPrimary: number
  roleCode: string | null
  birthday: string | null
  remark: string | null
  creatorId: number | null
  createdAt: string
  updaterId: number | null
  updatedAt: string
}

export interface ContactCreateInput {
  customerId: number
  name: string
  gender?: number
  mobile?: string | null
  phone?: string | null
  email?: string | null
  department?: string | null
  position?: string | null
  isPrimary?: number
  roleCode?: string | null
  birthday?: string | null
  remark?: string | null
}

export interface ContactUpdateInput extends Partial<Omit<ContactCreateInput, 'customerId'>> {}

/* ─── 跟进 ────────────────────────────────────────── */

export type ActivityType = 'phone' | 'wechat' | 'visit' | 'meeting' | 'email' | 'other'
export type ActivityCategory = 'follow_up' | 'system' | 'business'
export type FollowUpResult =
  | 'continue'
  | 'interested'
  | 'not_now'
  | 'unreachable'
  | 'invalid'

export interface ActivityRow {
  id: number
  customerId: number
  contactId: number | null
  category?: ActivityCategory | null
  type: string
  content: string
  occurredAt: string
  nextFollowUpAt: string | null
  result?: string | null
  nextFollowUpPlan?: string | null
  attachmentIds?: number[] | null
  metadata?: Record<string, unknown> | null
  operatorUserId: number
  operatorUserName: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Phase 1 polymorphic：跟进响应包含 entityType/entityId。
 * Phase 4 拜访：plannedAt/location/participants/visitResultCode/summary。
 */
export interface ActivityResp {
  id: number
  /** @deprecated 兼容旧字段；新代码用 entityType/entityId */
  customerId: number | null
  contactId: number | null
  entityType: 'customer' | 'opportunity' | 'contract' | null
  entityId: number | null
  entityRefType: string | null
  category?: ActivityCategory | null
  type: string
  content: string
  occurredAt: string
  nextFollowUpAt: string | null
  result?: string | null
  nextFollowUpPlan?: string | null
  attachmentIds?: number[] | null
  metadata?: Record<string, unknown> | null
  plannedAt: string | null
  location: string | null
  participants: string | null
  visitResultCode: string | null
  summary: string | null
  operatorUserId: number
  operatorUserName: string | null
  createdAt: string
  updatedAt: string
}

export interface ActivityCreateInput {
  contactId?: number | null
  type: ActivityType
  content: string
  occurredAt?: string
  nextFollowUpAt?: string | null
  result?: FollowUpResult | null
  nextFollowUpPlan?: string | null
  attachmentIds?: number[] | null
  metadata?: Record<string, unknown> | null
}

/* ─── 销售与工作台 ─────────────────────────────────────── */

export type OpportunityStage =
  | 'needs_confirmation'
  | 'solution'
  | 'quotation'
  | 'negotiation'
  | 'won'
  | 'lost'

export interface OpportunityRow {
  id: number
  opportunityNo: string
  name: string
  customerId: number
  customerName?: string | null
  stage: OpportunityStage
  amountCents: number | null
  expectedCloseDate: string | null
  sourceId?: number | null
  ownerName: string | null
  ownerId: number | null
  primaryContactId: number | null
  products: Array<{ id: number; code: string; name: string }>
  requirement?: string | null
  competition?: string | null
  nextAction?: string | null
  nextFollowUpAt?: string | null
  lastFollowUpAt?: string | null
  remark?: string | null
  stageEnteredAt?: string
  updatedAt?: string
}

export type QuotationStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'voided' | 'superseded'
export interface QuoteSeriesSummary {
  seriesId?: string
  seriesNo?: string
  title?: string
  customerId: number
  customerName?: string | null
  opportunityId?: number | null
  opportunityName?: string | null
  opportunityNo?: string | null
  currentQuoteId?: number
  currentVersion?: number
  versionCount?: number
  currentStatus?: QuotationStatus
  currentAmount?: number
  quoteDate?: string | null
  validUntil?: string | null
  customerViewStatus?: 'viewed' | 'unviewed'
  lastViewedAt?: string | null
  viewCount?: number
  ownerUserId?: number
  ownerUserName?: string | null
  hasActiveShare?: boolean
}
export interface QuotationVersionSummary {
  id: number
  quotationNo: string
  version: number
  status: QuotationStatus
  totalCents: number
  quoteDate: string | null
  createdAt: string
  shareFirstViewedAt?: string | null
  shareViewCount?: number
  hasShare?: boolean
}
export type QuotationRow = Omit<QuotationResp, 'items'>
export interface QuotationShareInfo {
  id: number
  url?: string
  status: 'active' | 'revoked'
  expiresAt: string
  sentAt: string | null
  firstViewedAt: string | null
  lastViewedAt: string | null
  viewCount: number
}
type GeneratedQuotationResp = Awaited<ReturnType<typeof crmQuotationsGet>>['data']
export type QuotationResp = Omit<GeneratedQuotationResp, 'acceptedBy' | 'contractId' | 'shareFirstViewedAt' | 'shareViewCount' | 'share' | 'hasShare' | 'seriesId' | 'seriesNo' | 'seriesTitle' | 'currentVersion' | 'versionCount' | 'versions' | 'publicDiscountDescription' | 'internalDiscountReason'> & { acceptedBy?: number | null; contractId?: number | null; shareFirstViewedAt?: string | null; shareViewCount?: number; publicDiscountDescription?: string | null; internalDiscountReason?: string | null; share?: QuotationShareInfo | null; hasShare?: boolean; seriesId?: string; seriesNo?: string; seriesTitle?: string; opportunityNo?: string | null; currentVersion?: number; versionCount?: number; versions?: QuotationVersionSummary[] }
export type QuotationCreateInput = Parameters<typeof crmQuotationsCreate>[0]
export type QuotationItemInput = QuotationCreateInput['items'][number]

export interface ContractRow {
  id: number
  contractNo: string
  name: string
  customerId: number
  opportunityId: number | null
  opportunityName?: string | null
  quotationId: number | null
  quotationNo?: string | null
  contactId: number | null
  contactName?: string | null
  ownerUserName?: string | null
  amountCents: number
  status: string
  signedAt: string | null
  effectiveAt: string | null
  expiresAt: string | null
  description: string | null
  createdAt: string
}

export async function listAllPages<T>(load: (page: number, pageSize: number) => Promise<{ data: T[]; total: number }>): Promise<T[]> {
  const pageSize = 100;
  const first = await load(1, pageSize);
  const pages = Math.ceil(first.total / pageSize);
  if (pages <= 1) return first.data;
  const rest = await Promise.all(Array.from({ length: pages - 1 }, (_, index) => load(index + 2, pageSize)));
  return first.data.concat(...rest.map((result) => result.data));
}
export interface ContractInput {
  name: string
  customerId: number
  opportunityId?: number | null
  quotationId?: number | null
  contactId?: number | null
  amountCents: number
  signedAt?: string | null
  effectiveAt?: string | null
  expiresAt?: string | null
  status?: string
  description?: string | null
}

/**
 * 收款方式字典（与后端 sys_enum 'crm_payment_method' seed 对齐）。
 * 顺序与金额无关，按使用频率排列；其他 / 银行转账 / 移动支付 / 现金 / 票据。
 */
export const PAYMENT_METHOD_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'bank_transfer', label: '银行转账' },
  { value: 'alipay', label: '支付宝' },
  { value: 'wechat', label: '微信支付' },
  { value: 'cash', label: '现金' },
  { value: 'check', label: '支票' },
  { value: 'other', label: '其他' },
]

/**
 * 客户级回款汇总（前端轻量统计用）。
 */
export interface PaymentCustomerSummary {
  totalContractCents: number
  paidCents: number
  outstandingCents: number
}

/**
 * 合同级回款汇总（Modal 选中合同后展示上下文）。
 */
export interface PaymentContractSummary {
  contractId: number
  contractNo: string
  contractName: string
  contractAmountCents: number
  paidCents: number
  outstandingCents: number
}

export interface PaymentRow {
  id: number
  paymentNo: string
  contractId: number
  customerId: number
  amountCents: number
  paidAt: string
  methodCode: string
  transactionNo: string | null
  status: string
  remark: string | null
  contractNo?: string
  contractName?: string
  customerName?: string
  creatorId?: number | null
  creatorName?: string | null
  createdAt?: string
}
export interface PaymentInput {
  amountCents: number
  paidAt: string
  methodCode?: string
  transactionNo?: string | null
  remark?: string | null
}

/**
 * 任务优先级字典（3 档；与后端 TASK_PRIORITIES 对齐）。
 * UI 不引入 5 档；颜色用 Ant Design semantic。
 */
export const TASK_PRIORITY_OPTIONS: ReadonlyArray<{
  value: string
  label: string
  semantic: 'default' | 'warning' | 'error'
}> = [
  { value: 'normal', label: '普通', semantic: 'default' },
  { value: 'high', label: '重要', semantic: 'warning' },
  { value: 'urgent', label: '紧急', semantic: 'error' },
]

export interface TaskRow {
  id: number
  customerId: number
  title: string
  status: string
  priority: string
  assigneeUserId: number | null
  assigneeName?: string | null
  dueAt: string | null
  completedAt: string | null
  description: string | null
  creatorId?: number | null
  creatorName?: string | null
  createdAt?: string
  updatedAt?: string
}
export interface TaskInput {
  customerId: number
  title: string
  status?: string
  priority?: string
  assigneeUserId?: number | null
  dueAt?: string | null
  description?: string | null
}

export interface ProductRow {
  id: number
  code: string
  name: string
  categoryCode: string | null
  categoryName: string | null
  unitCode: string | null
  unitName: string | null
  standardPriceCents: number
  taxRateBp: number
  enabled: number
  description: string | null
}

export interface CrmAttachmentRow {
  id: number
  customerId: number
  entityType: 'customer' | 'activity'
  entityId: number | null
  attachmentId: number
  name?: string | null
  url?: string | null
  createdAt: string
}

/* ─── Tag / Status / Source ────────────────────────────────────────── */

export interface TagRow {
  id: number
  name: string
  color: string | null
  enabled: number
  createdAt: string
  updatedAt: string
}
export interface TagInput {
  name: string
  color?: string | null
  enabled?: number
}

export interface StatusRow {
  id: number
  name: string
  code: string | null
  type: string
  sort: number
  enabled: number
  isSystem: number
  createdAt: string
  updatedAt: string
}
export interface StatusInput {
  name: string
  code?: string | null
  type?: string
  sort?: number
  enabled?: number
}

export interface SourceRow {
  id: number
  name: string
  code: string | null
  sort: number
  enabled: number
  createdAt: string
  updatedAt: string
}
export interface SourceInput {
  name: string
  code?: string | null
  sort?: number
  enabled?: number
}

/* ─── Dashboard ────────────────────────────────────────── */

export interface DashboardData {
  counters: {
    myCustomers: number
    pendingFollowUp: number
    overdueFollowUp: number
    todayNew: number
    publicPool: number
    weekFollowUps: number
    monthNew: number
  }
  pendingFollowUps: Array<{
    id: number
    name: string
    ownerUserName: string | null
    nextFollowUpAt: string | null
    statusName: string | null
  }>
  recentActivities: Array<{
    id: number
    type: string
    operatorUserName: string | null
    customerId: number
    customerName: string
    occurredAt: string
    summary: string
  }>
}

/* ─── API 调用 ────────────────────────────────────────── */

const unwrap = <T>(r: ApiResp<T>): T => r.data

/* Customer */

export async function listCustomers(query: CustomerListQuery): Promise<{ data: CustomerRow[]; total: number }> {
  const r = await request<ApiResp<CustomerRow[]>>('/api/crm/v1/customers', {
    method: 'GET',
    params: query as any,
  })
  return { data: unwrap(r), total: r.pagination?.total ?? 0 }
}

export interface CustomerListOptions {
  canFilterOwners: boolean
  owners: Array<{ id: number; name: string }>
}

export async function getCustomerListOptions(): Promise<CustomerListOptions> {
  const r = await request<ApiResp<CustomerListOptions>>('/api/crm/v1/customers/options', { method: 'GET' })
  return unwrap(r)
}

export async function getCustomer(id: number): Promise<CustomerDetail> {
  const r = await request<ApiResp<CustomerDetail>>(`/api/crm/v1/customers/${id}`, { method: 'GET' })
  return unwrap(r)
}

export async function createCustomer(input: CustomerCreateInput): Promise<{ customer: CustomerRow; duplicate: any | null }> {
  const r = await request<ApiResp<{ customer: CustomerRow; duplicate: any | null }>>('/api/crm/v1/customers', {
    method: 'POST',
    data: input,
  })
  return unwrap(r)
}

export async function updateCustomer(id: number, input: CustomerUpdateInput): Promise<CustomerRow> {
  const r = await request<ApiResp<CustomerRow>>(`/api/crm/v1/customers/${id}`, {
    method: 'PATCH',
    data: input,
  })
  return unwrap(r)
}

export type CustomerRelationshipStatusTarget = 'potential' | 'following' | 'lost'

export interface CustomerRelationshipStatusTransitionInput {
  target: CustomerRelationshipStatusTarget
  reasonCode?: string
  remark?: string
}

export async function transitionCustomerRelationshipStatus(
  id: number,
  input: CustomerRelationshipStatusTransitionInput,
): Promise<CustomerDetail> {
  const r = await request<ApiResp<CustomerDetail>>(
    `/api/crm/v1/customers/${id}/relationship-status-transitions`,
    { method: 'POST', data: input },
  )
  return unwrap(r)
}

export async function deleteCustomer(id: number): Promise<void> {
  await request(`/api/crm/v1/customers/${id}`, { method: 'DELETE' })
}

export async function claimCustomer(id: number): Promise<CustomerRow> {
  const r = await request<ApiResp<CustomerRow>>(`/api/crm/v1/customers/${id}/claim`, {
    method: 'POST',
  })
  return unwrap(r)
}

export async function releaseCustomer(id: number, reason?: string): Promise<CustomerRow> {
  const r = await request<ApiResp<CustomerRow>>(`/api/crm/v1/customers/${id}/release`, {
    method: 'POST',
    data: { reason },
  })
  return unwrap(r)
}

export async function transferCustomer(id: number, targetUserId: number, reason?: string): Promise<CustomerRow> {
  const r = await request<ApiResp<CustomerRow>>(`/api/crm/v1/customers/${id}/transfer`, {
    method: 'POST',
    data: { targetUserId, reason },
  })
  return unwrap(r)
}

export async function listPool(query: CustomerListQuery): Promise<{ data: CustomerRow[]; total: number }> {
  const r = await request<ApiResp<CustomerRow[]>>('/api/crm/v1/pool', {
    method: 'GET',
    params: query as any,
  })
  return { data: unwrap(r), total: r.pagination?.total ?? 0 }
}

export interface TransferLogRow {
  id: number
  customerId: number
  type: string
  fromUserId: number | null
  toUserId: number | null
  operatorUserId: number
  reason: string | null
  createdAt: string
  fromUserName: string | null
  toUserName: string | null
  operatorUserName: string | null
}

export async function listTransfers(customerId: number): Promise<TransferLogRow[]> {
  const r = await request<ApiResp<TransferLogRow[]>>(`/api/crm/v1/customers/${customerId}/transfers`, {
    method: 'GET',
  })
  return unwrap(r)
}

/* Customer Members（协同人） */

export interface CustomerMemberRow {
  id: number
  customerId: number
  userId: number
  role: string
  createdAt: string
  userName: string | null
}

export async function listMembers(customerId: number): Promise<CustomerMemberRow[]> {
  const r = await request<ApiResp<{ items: CustomerMemberRow[] }>>(
    `/api/crm/v1/customers/${customerId}/members`,
    { method: 'GET' },
  )
  return unwrap(r).items ?? []
}

/* Contact */

export async function listContacts(query: { customerId?: number; page?: number; pageSize?: number; keyword?: string }): Promise<{ data: ContactRow[]; total: number }> {
  const r = await request<ApiResp<ContactRow[]>>('/api/crm/v1/contacts', {
    method: 'GET',
    params: query as any,
  })
  return { data: unwrap(r), total: r.pagination?.total ?? 0 }
}

export async function listContactsByCustomer(customerId: number): Promise<ContactRow[]> {
  const r = await request<ApiResp<ContactRow[]>>(`/api/crm/v1/customers/${customerId}/contacts`, {
    method: 'GET',
  })
  return unwrap(r)
}

export async function createContactForCustomer(customerId: number, input: Omit<ContactCreateInput, 'customerId'>): Promise<ContactRow> {
  const r = await request<ApiResp<ContactRow>>(`/api/crm/v1/customers/${customerId}/contacts`, {
    method: 'POST',
    data: input,
  })
  return unwrap(r)
}

export async function createContact(input: ContactCreateInput): Promise<ContactRow> {
  const r = await request<ApiResp<ContactRow>>('/api/crm/v1/contacts', {
    method: 'POST',
    data: input,
  })
  return unwrap(r)
}

export async function updateContact(id: number, input: ContactUpdateInput): Promise<ContactRow> {
  const r = await request<ApiResp<ContactRow>>(`/api/crm/v1/contacts/${id}`, {
    method: 'PATCH',
    data: input,
  })
  return unwrap(r)
}

export async function deleteContact(id: number): Promise<void> {
  await request(`/api/crm/v1/contacts/${id}`, { method: 'DELETE' })
}

/* Activity */

export async function listActivitiesByCustomer(customerId: number): Promise<{ total: number; items: ActivityRow[] }> {
  const r = await request<ApiResp<{ total: number; items: ActivityRow[] }>>(`/api/crm/v1/customers/${customerId}/activities`, {
    method: 'GET',
  })
  return unwrap(r)
}

export async function createActivity(customerId: number, input: ActivityCreateInput): Promise<ActivityRow> {
  const r = await request<ApiResp<ActivityRow>>(`/api/crm/v1/customers/${customerId}/activities`, {
    method: 'POST',
    data: input,
  })
  return unwrap(r)
}

export async function listOpportunities(
  query: PageQuery & {
    customerId?: number
    stage?: OpportunityStage
    ownerId?: number
    expectedCloseFrom?: string
    expectedCloseTo?: string
  },
): Promise<{ data: OpportunityRow[]; total: number }> {
  const r = await request<ApiResp<OpportunityRow[]>>('/api/crm/v1/opportunities', {
    method: 'GET',
    params: query,
  })
  return { data: unwrap(r), total: r.pagination?.total ?? 0 }
}

export interface OpportunityCreateInput {
  name: string
  customerId: number
  primaryContactId?: number | null
  ownerId: number
  stage?: Exclude<OpportunityStage, 'won' | 'lost'>
  amountCents?: number | null
  expectedCloseDate?: string | null
  sourceId?: number | null
  productIds?: number[]
  requirement: string
  competition?: string | null
  remark?: string
  nextAction?: string
  nextFollowUpAt?: string | null
  creationKey?: string
}

export async function createOpportunity(input: OpportunityCreateInput): Promise<OpportunityRow> {
  const r = await request<ApiResp<OpportunityRow>>('/api/crm/v1/opportunities', { method: 'POST', data: input })
  return unwrap(r)
}

export async function checkOpportunityDuplicates(customerId: number, name: string): Promise<OpportunityRow[]> {
  const r = await request<ApiResp<OpportunityRow[]>>('/api/crm/v1/opportunities/duplicate-check', {
    method: 'GET',
    params: { customerId, name },
  })
  return unwrap(r)
}

export async function advanceOpportunityStage(id: number, input: { toStage: 'solution' | 'quotation' | 'negotiation'; reason?: string }): Promise<OpportunityRow> {
  const r = await request<ApiResp<OpportunityRow>>(`/api/crm/v1/opportunities/${id}/advance`, { method: 'POST', data: input });
  return unwrap(r);
}

export async function listQuotations(query: PageQuery & { customerId?: number; opportunityId?: number; status?: QuotationStatus }): Promise<{ data: QuoteSeriesSummary[]; total: number }> {
  const r = await crmQuotationsList(query as Parameters<typeof crmQuotationsList>[0])
  return { data: unwrap(r) as unknown as QuoteSeriesSummary[], total: r.pagination?.total ?? 0 }
}

export async function getQuotationDuplicates(opportunityId: number, name: string): Promise<QuoteSeriesSummary[]> {
  const r = await request<ApiResp<QuoteSeriesSummary[]>>('/api/crm/v1/quotations/duplicates', {
    method: 'GET', params: { opportunityId, name },
  })
  return unwrap(r)
}

export async function getQuotation(id: number): Promise<QuotationResp> {
  return unwrap(await crmQuotationsGet({ id })) as unknown as QuotationResp
}

export async function reviseQuotation(id: number): Promise<QuotationResp> {
  return unwrap(await crmQuotationsRevise({ id })) as unknown as QuotationResp
}

export interface QuoteShareCreateResult {
  shareId: number
  url: string
  expiresAt: string
}

export async function createQuotationShare(id: number, input: { durationDays?: 3 | 7 | 14 | 30; followQuoteValidUntil?: boolean; customDate?: string; replaceShareId?: number }): Promise<QuoteShareCreateResult> {
  return unwrap(await request<ApiResp<QuoteShareCreateResult>>(`/api/crm/v1/quotations/${id}/shares`, { method: 'POST', data: input }))
}

export async function confirmQuotation(id: number): Promise<QuotationResp> {
  return unwrap(await crmQuotationsAccept({ id })) as unknown as QuotationResp
}

export interface RevokeQuotationConfirmationInput { reason: 'mistake' | 'customer_unconfirmed' | 'other'; remark?: string }
export async function revokeQuotationConfirmation(id: number, input: RevokeQuotationConfirmationInput): Promise<QuotationResp> {
  return unwrap(await crmQuotationsRevokeConfirmation({ id }, input)) as unknown as QuotationResp
}

export async function sendQuotation(id: number, shareId: number): Promise<QuotationResp> {
  return unwrap(await request<ApiResp<QuotationResp>>(`/api/crm/v1/quotations/${id}/send`, { method: 'POST', data: { shareId } }))
}

export async function revokeQuotationShare(id: number, shareId: number): Promise<void> {
  await request(`/api/crm/v1/quotations/${id}/shares/${shareId}/revoke`, { method: 'POST' })
}

export async function createQuotation(input: QuotationCreateInput): Promise<QuotationResp> {
  return unwrap(await crmQuotationsCreate(input)) as unknown as QuotationResp
}

export async function updateQuotation(id: number, input: Parameters<typeof crmQuotationsUpdate>[1]): Promise<QuotationResp> {
  return unwrap(await crmQuotationsUpdate({ id }, input)) as unknown as QuotationResp
}

export async function voidQuotation(id: number, reason: string): Promise<QuotationResp> {
  return unwrap(await crmQuotationsVoid({ id }, { reason })) as unknown as QuotationResp
}

export async function deleteQuotation(id: number): Promise<void> {
  await crmQuotationsDelete({ id })
}

export async function listContracts(query: PageQuery & { customerId?: number; status?: string }): Promise<{ data: ContractRow[]; total: number }> {
  const r = await request<ApiResp<ContractRow[]>>('/api/crm/v1/contracts', { method: 'GET', params: query as any })
  return { data: unwrap(r), total: r.pagination?.total ?? 0 }
}

export async function createContract(input: ContractInput): Promise<ContractRow> {
  const r = await request<ApiResp<ContractRow>>('/api/crm/v1/contracts', { method: 'POST', data: input })
  return unwrap(r)
}

export async function updateContract(id: number, input: Partial<Omit<ContractInput, 'customerId' | 'opportunityId' | 'amountCents'>>): Promise<ContractRow> {
  const r = await request<ApiResp<ContractRow>>(`/api/crm/v1/contracts/${id}`, { method: 'PATCH', data: input })
  return unwrap(r)
}

export async function deleteContract(id: number): Promise<void> {
  await request(`/api/crm/v1/contracts/${id}`, { method: 'DELETE' })
}

export async function listPaymentsByContract(contractId: number): Promise<PaymentRow[]> {
  const r = await request<ApiResp<PaymentRow[]>>(`/api/crm/v1/payments/contracts/${contractId}`, { method: 'GET' })
  return unwrap(r)
}

export async function listPayments(query: PageQuery & { contractId?: number; customerId?: number; methodCode?: string; paidFrom?: string; paidTo?: string }): Promise<{ data: PaymentRow[]; total: number }> {
  const r = await request<ApiResp<PaymentRow[]>>('/api/crm/v1/payments', { method: 'GET', params: query as any })
  return { data: unwrap(r), total: r.pagination?.total ?? 0 }
}

export async function createPayment(contractId: number, input: PaymentInput): Promise<PaymentRow> {
  const r = await request<ApiResp<PaymentRow>>(`/api/crm/v1/payments/contracts/${contractId}`, { method: 'POST', data: input })
  return unwrap(r)
}

export async function updatePayment(id: number, input: Partial<PaymentInput>): Promise<PaymentRow> {
  const r = await request<ApiResp<PaymentRow>>(`/api/crm/v1/payments/${id}`, { method: 'PATCH', data: input })
  return unwrap(r)
}

export async function deletePayment(id: number): Promise<void> {
  await request(`/api/crm/v1/payments/${id}`, { method: 'DELETE' })
}

export async function listTasks(query: PageQuery & { customerId?: number; status?: string }): Promise<{ data: TaskRow[]; total: number }> {
  const r = await request<ApiResp<TaskRow[]>>('/api/crm/v1/tasks', { method: 'GET', params: query as any })
  return { data: unwrap(r), total: r.pagination?.total ?? 0 }
}

export async function createTask(input: TaskInput): Promise<TaskRow> {
  const r = await request<ApiResp<TaskRow>>('/api/crm/v1/tasks', { method: 'POST', data: input })
  return unwrap(r)
}

export async function updateTask(id: number, input: Partial<Omit<TaskInput, 'customerId'>>): Promise<TaskRow> {
  const r = await request<ApiResp<TaskRow>>(`/api/crm/v1/tasks/${id}`, { method: 'PATCH', data: input })
  return unwrap(r)
}

/**
 * 完成任务：内部走 updateTask 写 status='completed' + completedAt=now。
 * 后端 service 自动维护 completedAt；前端不再传。
 */
export async function completeTask(id: number): Promise<TaskRow> {
  return updateTask(id, { status: 'completed' })
}

export async function deleteTask(id: number): Promise<void> {
  await request(`/api/crm/v1/tasks/${id}`, { method: 'DELETE' })
}

export async function listProducts(query: PageQuery & { enabled?: number }): Promise<{ data: ProductRow[]; total: number }> {
  const r = await request<ApiResp<ProductRow[]>>('/api/crm/v1/products', { method: 'GET', params: query as any })
  return { data: unwrap(r), total: r.pagination?.total ?? 0 }
}

export async function listCrmAttachments(customerId: number): Promise<CrmAttachmentRow[]> {
  const r = await request<ApiResp<CrmAttachmentRow[]>>('/api/crm/v1/attachments', { method: 'GET', params: { customerId } }) as ApiResp<CrmAttachmentRow[]>
  return unwrap(r)
}

export async function createCrmAttachment(input: Pick<CrmAttachmentRow, 'customerId' | 'entityType' | 'entityId' | 'attachmentId'>): Promise<CrmAttachmentRow> {
  const r = await request<ApiResp<CrmAttachmentRow>>('/api/crm/v1/attachments', { method: 'POST', data: input }) as ApiResp<CrmAttachmentRow>
  return unwrap(r)
}

export async function deleteCrmAttachment(id: number): Promise<void> {
  await request(`/api/crm/v1/attachments/${id}`, { method: 'DELETE' })
}

/* Settings — Tag */

export async function listTags(query: PageQuery): Promise<{ data: TagRow[]; total: number }> {
  const r = await request<ApiResp<TagRow[]>>('/api/crm/v1/settings/tags', {
    method: 'GET',
    params: query as any,
  })
  return { data: unwrap(r), total: r.pagination?.total ?? 0 }
}

export async function createTag(input: TagInput): Promise<TagRow> {
  const r = await request<ApiResp<TagRow>>('/api/crm/v1/settings/tags', {
    method: 'POST',
    data: input,
  })
  return unwrap(r)
}

export async function updateTag(id: number, input: Partial<TagInput>): Promise<TagRow> {
  const r = await request<ApiResp<TagRow>>(`/api/crm/v1/settings/tags/${id}`, {
    method: 'PATCH',
    data: input,
  })
  return unwrap(r)
}

export async function deleteTag(id: number): Promise<void> {
  await request(`/api/crm/v1/settings/tags/${id}`, { method: 'DELETE' })
}

/* Settings — Status */

export async function listStatuses(query: PageQuery): Promise<{ data: StatusRow[]; total: number }> {
  const r = await request<ApiResp<StatusRow[]>>('/api/crm/v1/settings/statuses', {
    method: 'GET',
    params: query as any,
  })
  return { data: unwrap(r), total: r.pagination?.total ?? 0 }
}

export async function createStatus(input: StatusInput): Promise<StatusRow> {
  const r = await request<ApiResp<StatusRow>>('/api/crm/v1/settings/statuses', {
    method: 'POST',
    data: input,
  })
  return unwrap(r)
}

export async function updateStatus(id: number, input: Partial<StatusInput>): Promise<StatusRow> {
  const r = await request<ApiResp<StatusRow>>(`/api/crm/v1/settings/statuses/${id}`, {
    method: 'PATCH',
    data: input,
  })
  return unwrap(r)
}

export async function deleteStatus(id: number): Promise<void> {
  await request(`/api/crm/v1/settings/statuses/${id}`, { method: 'DELETE' })
}

/* Settings — Source */

export async function listSources(query: PageQuery): Promise<{ data: SourceRow[]; total: number }> {
  const r = await request<ApiResp<SourceRow[]>>('/api/crm/v1/settings/sources', {
    method: 'GET',
    params: query as any,
  })
  return { data: unwrap(r), total: r.pagination?.total ?? 0 }
}

export async function createSource(input: SourceInput): Promise<SourceRow> {
  const r = await request<ApiResp<SourceRow>>('/api/crm/v1/settings/sources', {
    method: 'POST',
    data: input,
  })
  return unwrap(r)
}

export async function updateSource(id: number, input: Partial<SourceInput>): Promise<SourceRow> {
  const r = await request<ApiResp<SourceRow>>(`/api/crm/v1/settings/sources/${id}`, {
    method: 'PATCH',
    data: input,
  })
  return unwrap(r)
}

export async function deleteSource(id: number): Promise<void> {
  await request(`/api/crm/v1/settings/sources/${id}`, { method: 'DELETE' })
}

/* Dashboard */

export async function getDashboard(): Promise<DashboardData> {
  const r = await request<ApiResp<DashboardData>>('/api/crm/v1/dashboard', { method: 'GET' })
  return unwrap(r)
}

/* Masking helpers (公海敏感信息) */

export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '—'
  if (phone.length <= 7) return phone
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`
}

/* --------------------------------------------------------------------------
 * sys_enum 枚举中心
 *
 * URL: /api/v1/admin/enums/*（core 路由，自动挂在 admin 下）
 *
 * - listEnums / createEnum / updateEnum / deleteEnum  管理后台列表 CRUD
 * - listEnumByType  启用项的精简版（dropdown 用，60s 缓存）
 * - listEnumByTypes 批量拉取（首屏 SSR）
 * ------------------------------------------------------------------------ */

export interface EnumItem {
  id: number
  type: string
  code: string
  name: string
  sort: number
  enabled: number
  remark: string | null
  createdAt: string
  updatedAt: string
}

export interface EnumInput {
  type: string
  code: string
  name: string
  sort?: number
  enabled?: number
  remark?: string | null
}

export interface EnumUpdateInput {
  name?: string
  sort?: number
  enabled?: number
  remark?: string | null
}

export interface EnumCodeNameItem {
  code: string
  name: string
  sort: number
}

export async function listEnums(query: PageQuery & { type?: string; keyword?: string }): Promise<{
  data: EnumItem[]
  total: number
}> {
  const r = await request<ApiResp<EnumItem[]>>('/api/v1/admin/enums', {
    method: 'GET',
    params: query as any,
  })
  return { data: unwrap(r), total: r.pagination?.total ?? 0 }
}

export async function listEnumTypes(): Promise<string[]> {
  const r = await request<ApiResp<string[]>>('/api/v1/admin/enums/types', { method: 'GET' })
  return unwrap(r)
}

export async function listEnumByType(type: string): Promise<EnumCodeNameItem[]> {
  const r = await request<ApiResp<{ type: string; items: EnumCodeNameItem[] }>>(
    '/api/v1/admin/enums/by-type',
    { method: 'GET', params: { type } },
  )
  return unwrap(r).items
}

export async function listEnumByTypes(types: string[]): Promise<Record<string, EnumCodeNameItem[]>> {
  if (types.length === 0) return {}
  const r = await request<ApiResp<{ items: Record<string, EnumCodeNameItem[]> }>>(
    '/api/v1/admin/enums/by-types',
    { method: 'GET', params: { types: types.join(',') } },
  )
  return unwrap(r).items
}

export async function createEnum(input: EnumInput): Promise<EnumItem> {
  const r = await request<ApiResp<EnumItem>>('/api/v1/admin/enums', {
    method: 'POST',
    data: input,
  })
  return unwrap(r)
}

export async function updateEnum(id: number, input: EnumUpdateInput): Promise<EnumItem> {
  const r = await request<ApiResp<EnumItem>>(`/api/v1/admin/enums/${id}`, {
    method: 'PUT',
    data: input,
  })
  return unwrap(r)
}

export async function deleteEnum(id: number): Promise<{ id: number; affected: number }> {
  const r = await request<ApiResp<{ id: number; affected: number }>>(`/api/v1/admin/enums/${id}`, {
    method: 'DELETE',
  })
  return unwrap(r)
}

/* --------------------------------------------------------------------------
 * 拜访（crm_activity.type='visit'）独立列表
 *
 * URL: /api/crm/v1/visits
 * ------------------------------------------------------------------------ */

export async function listVisits(query: {
  customerId?: number
  plannedFrom?: string
  plannedTo?: string
  page?: number
  pageSize?: number
}): Promise<{ data: ActivityResp[]; total: number }> {
  const r = await request<ApiResp<ActivityResp[]>>('/api/crm/v1/visits', {
    method: 'GET',
    params: query as any,
  })
  return { data: unwrap(r), total: r.pagination?.total ?? 0 }
}
