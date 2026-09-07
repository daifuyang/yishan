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
export type LeadStatus = 'pending' | 'contact_valid' | 'contact_invalid' | 'closed'

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

export interface LeadRow {
  id: number; name: string | null; companyName: string | null; mobile: string | null; phone: string | null; email: string | null; wechat: string | null; qq: string | null; sourceId: number | null; intention: string | null; status: LeadStatus; ownerUserId: number | null; ownerUserName: string | null; ownerDepartmentId: number | null; poolStatus: 'owned' | 'public' | 'unassigned'; createdBy: number | null; lastFollowUpAt: string | null; nextFollowUpAt: string | null; disqualifyReason: string | null; disqualifyCode: string | null; convertedCustomerId: number | null; convertedContactId: number | null; convertedAt: string | null; isConverted: boolean; createdAt: string; updatedAt: string
}
function withLeadConversionState(lead: Omit<LeadRow, 'isConverted'>): LeadRow {
  return { ...lead, isConverted: lead.convertedCustomerId !== null }
}
/**
 * 创建请求不传 ownerUserId/ownerDepartmentId/poolStatus：
 * 服务端按当前认证用户自动写入 createdBy=ownerUserId=currentUser.id、poolStatus='owned'。
 */
export interface LeadCreateInput { name?: string; companyName?: string; mobile?: string; phone?: string; email?: string; wechat?: string; qq?: string; sourceId?: number | null; intention?: string }
/**
 * PATCH /leads/:id 资料字段：仅白名单生效。
 * ownerUserId/status/poolStatus/converted* 等业务字段必须走专门接口。
 */
export interface LeadUpdateInput { name?: string; companyName?: string; mobile?: string; phone?: string; email?: string; wechat?: string; qq?: string; sourceId?: number | null; intention?: string }
export async function listLeads(query: PageQuery & { status?: LeadStatus; ownerUserId?: number; pool?: boolean }): Promise<{ data: LeadRow[]; total: number }> { const r = await request<ApiResp<Omit<LeadRow, 'isConverted'>[]>>('/api/crm/v1/leads', { method: 'GET', params: query as any }); return { data: unwrap(r).map(withLeadConversionState), total: r.pagination?.total ?? 0 } }
export async function createLead(input: LeadCreateInput): Promise<LeadRow> { const r = await request<ApiResp<Omit<LeadRow, 'isConverted'>>>('/api/crm/v1/leads', { method: 'POST', data: input }); return withLeadConversionState(unwrap(r)) }
export async function updateLead(id: number, input: LeadUpdateInput): Promise<LeadRow> { const r = await request<ApiResp<Omit<LeadRow, 'isConverted'>>>(`/api/crm/v1/leads/${id}`, { method: 'PATCH', data: input }); return withLeadConversionState(unwrap(r)) }
export async function assignLead(id: number, targetUserId: number | null): Promise<LeadRow> { const r = await request<ApiResp<Omit<LeadRow, 'isConverted'>>>(`/api/crm/v1/leads/${id}/assign`, { method: 'POST', data: { targetUserId } }); return withLeadConversionState(unwrap(r)) }
export async function claimLead(id: number): Promise<LeadRow> { const r = await request<ApiResp<Omit<LeadRow, 'isConverted'>>>(`/api/crm/v1/leads/${id}/claim`, { method: 'POST' }); return withLeadConversionState(unwrap(r)) }
export interface LeadQualifyInput { evidence: string; nextAction: string }
export async function qualifyLead(id: number, input: LeadQualifyInput): Promise<LeadRow> { const r = await request<ApiResp<Omit<LeadRow, 'isConverted'>>>(`/api/crm/v1/leads/${id}/qualify`, { method: 'POST', data: input }); return withLeadConversionState(unwrap(r)) }
export type DisqualifyCode = 'duplicate' | 'not_target' | 'no_demand' | 'unreachable' | 'invalid_contact' | 'rejected' | 'other'
export interface LeadDisqualifyInput { code: DisqualifyCode; reason: string }
export async function disqualifyLead(id: number, input: LeadDisqualifyInput): Promise<LeadRow> { const r = await request<ApiResp<Omit<LeadRow, 'isConverted'>>>(`/api/crm/v1/leads/${id}/disqualify`, { method: 'POST', data: input }); return withLeadConversionState(unwrap(r)) }
export async function reactivateLead(id: number, reason: string): Promise<LeadRow> { const r = await request<ApiResp<Omit<LeadRow, 'isConverted'>>>(`/api/crm/v1/leads/${id}/reactivate`, { method: 'POST', data: { reason } }); return withLeadConversionState(unwrap(r)) }
export interface LeadConversionPreviewCustomer { id: number; name: string; type: 'enterprise' | 'individual'; ownerUserId: number | null; ownerUserName: string | null }
export interface LeadConversionPreviewContact { id: number; customerId: number; name: string; mobile: string | null; email: string | null }
export interface LeadConversionPreview { lead: LeadRow; customers: LeadConversionPreviewCustomer[]; contacts: LeadConversionPreviewContact[] }
export async function getLeadConversionPreview(id: number): Promise<LeadConversionPreview> { const r = await request<ApiResp<Omit<LeadConversionPreview, 'lead'> & { lead: Omit<LeadRow, 'isConverted'> }>>(`/api/crm/v1/leads/${id}/conversion-preview`, { method: 'GET' }); const preview = unwrap(r); return { ...preview, lead: withLeadConversionState(preview.lead) } }
export type LeadConvertInput = {
  customer:
    | { mode: 'existing'; customerId: number }
    | { mode: 'create'; name: string; type: 'enterprise' | 'individual'; phone?: string | null }
  contact:
    | { mode: 'existing'; contactId: number }
    | { mode: 'create'; name: string; mobile?: string | null; phone?: string | null; email?: string | null }
}
export interface LeadConversionResult { lead: LeadRow; customer: LeadRow; contact: LeadConversionPreviewContact }
export async function convertLead(id: number, input: LeadConvertInput): Promise<LeadConversionResult> { const r = await request<ApiResp<Omit<LeadConversionResult, 'lead' | 'customer'> & { lead: Omit<LeadRow, 'isConverted'>; customer: Omit<LeadRow, 'isConverted'> }>>(`/api/crm/v1/leads/${id}/convert`, { method: 'POST', data: input }); const result = unwrap(r); return { ...result, lead: withLeadConversionState(result.lead), customer: withLeadConversionState(result.customer) } }
export interface LeadActivityRow { id: number; leadId: number; type: string; content: string; occurredAt: string; nextFollowUpAt: string | null; operatorUserId: number; operatorUserName: string | null; createdAt: string; updatedAt: string }
export interface LeadActivityCreateInput { type: ActivityType; content: string; occurredAt?: string; nextFollowUpAt?: string | null }
/**
 * 写跟进成功响应：activity + 最新 lead。客户端必须在写完一次跟进后用 lead 替换本地状态，
 * 这样首次跟进触发的 new → processing 才能立刻反映在 UI 上。
 */
export interface LeadActivityCreateResponse { activity: LeadActivityRow; lead: LeadRow }
export async function listLeadActivities(id: number): Promise<{ total: number; items: LeadActivityRow[] }> { const r = await request<ApiResp<{ total: number; items: LeadActivityRow[] }>>(`/api/crm/v1/leads/${id}/activities`, { method: 'GET' }); return unwrap(r) }
export async function createLeadActivity(id: number, input: LeadActivityCreateInput): Promise<LeadActivityCreateResponse> { const r = await request<ApiResp<Omit<LeadActivityCreateResponse, 'lead'> & { lead: Omit<LeadRow, 'isConverted'> }>>(`/api/crm/v1/leads/${id}/activities`, { method: 'POST', data: input }); const result = unwrap(r); return { ...result, lead: withLeadConversionState(result.lead) } }

export interface CustomerListQuery extends PageQuery {
  statusId?: number
  sourceId?: number
  level?: string
  type?: string
  ownerUserId?: number
  poolStatus?: PoolStatus
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
