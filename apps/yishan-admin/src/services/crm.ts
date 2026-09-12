/**
 * CRM 前端 API 客户端（手工类型）。
 *
 * 由 `pnpm --filter yishan-admin openapi` 重新生成 services 后，
 * 这部分可以替换为 `import * as crm from '@/services/generated/crm'`。
 *
 * 这里先以手工类型 + request() 的方式暴露，避免后端未跑时阻塞前端开发。
 */

import { request } from '@umijs/max'

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
export type CustomerListView = 'all' | 'mine' | 'collaborating' | 'pending' | 'stale7d' | 'pool'
export type CustomerSortOrder = 'asc' | 'desc'
export type CustomerSortField = 'updatedAt' | 'nextFollowUpAt' | 'lastFollowUpAt' | 'createdAt' | 'name' | 'level'

export interface CustomerRow {
  id: number
  code: string | null
  name: string
  type: string
  statusId: number | null
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
}

export interface CustomerCreateInput {
  name: string
  type?: CustomerType
  statusId?: number | null
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
  statusId?: number
  sourceId?: number
  level?: string
  type?: CustomerType
  industry?: string
  ownerUserId?: number
  collaboratorId?: number
  tagIds?: number[]
  poolStatus?: PoolStatus
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
  birthday?: string | null
  remark?: string | null
}

export interface ContactUpdateInput extends Partial<Omit<ContactCreateInput, 'customerId'>> {}

/* ─── 跟进 ────────────────────────────────────────── */

export type ActivityType = 'phone' | 'wechat' | 'visit' | 'meeting' | 'email' | 'other'

export interface ActivityRow {
  id: number
  customerId: number
  contactId: number | null
  type: string
  content: string
  occurredAt: string
  nextFollowUpAt: string | null
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
  entityType: 'lead' | 'customer' | 'opportunity' | 'contract' | null
  entityId: number | null
  entityRefType: string | null
  type: string
  content: string
  occurredAt: string
  nextFollowUpAt: string | null
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
