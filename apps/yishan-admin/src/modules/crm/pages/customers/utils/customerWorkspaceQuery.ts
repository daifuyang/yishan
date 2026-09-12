import type {
  CustomerListQuery,
  CustomerSortField,
  CustomerSortOrder,
  CustomerType,
  PoolStatus,
} from '@/services/crm'
import type {
  CustomerViewId,
  CustomerWorkspaceFilters,
  CustomerWorkspaceQuery,
} from '../types'

const DEFAULT_QUERY: Pick<CustomerWorkspaceQuery, 'view' | 'page' | 'pageSize'> = {
  view: 'all',
  page: 1,
  pageSize: 10,
}

const CUSTOMER_VIEWS: CustomerViewId[] = ['all', 'mine', 'pending', 'important', 'pool']
const CUSTOMER_TYPES: CustomerType[] = ['enterprise', 'individual']
const POOL_STATUSES: PoolStatus[] = ['owned', 'public']
const CUSTOMER_SORT_FIELDS: CustomerSortField[] = ['updatedAt', 'nextFollowUpAt', 'lastFollowUpAt', 'createdAt', 'name', 'level']
const CUSTOMER_SORT_ORDERS: CustomerSortOrder[] = ['asc', 'desc']
const MAX_KEYWORD_LENGTH = 100
const MAX_PAGE_SIZE = 200

const STRING_FILTER_KEYS: Array<keyof Pick<CustomerWorkspaceFilters, 'level' | 'industry'>> = [
  'level',
  'industry',
]

const DATE_FILTER_KEYS: Array<keyof Pick<
  CustomerWorkspaceFilters,
  | 'createdAtFrom'
  | 'createdAtTo'
  | 'lastFollowUpAtFrom'
  | 'lastFollowUpAtTo'
  | 'nextFollowUpAtFrom'
  | 'nextFollowUpAtTo'
>> = [
  'createdAtFrom',
  'createdAtTo',
  'lastFollowUpAtFrom',
  'lastFollowUpAtTo',
  'nextFollowUpAtFrom',
  'nextFollowUpAtTo',
]

const NUMBER_FILTER_KEYS: Array<keyof Pick<
  CustomerWorkspaceFilters,
  'statusId' | 'sourceId' | 'ownerUserId' | 'collaboratorUserId' | 'tagId'
>> = ['statusId', 'sourceId', 'ownerUserId', 'collaboratorUserId', 'tagId']

function toPositiveInteger(value: string | null): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined
}

function toPageSize(value: string | null): number | undefined {
  const pageSize = toPositiveInteger(value)
  return pageSize && pageSize <= MAX_PAGE_SIZE ? pageSize : undefined
}

function isValidDateTime(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})T/.exec(value)
  if (!match || Number.isNaN(Date.parse(value))) return false
  const [year, month, day] = match.slice(1).map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function getParams(search: string | URLSearchParams): URLSearchParams {
  return typeof search === 'string' ? new URLSearchParams(search) : search
}

export function parseCustomerWorkspaceQuery(search: string | URLSearchParams): CustomerWorkspaceQuery {
  const params = getParams(search)
  const view = params.get('view')
  const parsed: CustomerWorkspaceQuery = {
    view: CUSTOMER_VIEWS.includes(view as CustomerViewId) ? (view as CustomerViewId) : DEFAULT_QUERY.view,
    page: toPositiveInteger(params.get('page')) ?? DEFAULT_QUERY.page,
    pageSize: toPageSize(params.get('pageSize')) ?? DEFAULT_QUERY.pageSize,
  }

  const customerId = toPositiveInteger(params.get('customerId'))
  if (customerId) parsed.customerId = customerId

  const keyword = params.get('keyword')
  if (keyword && keyword.length <= MAX_KEYWORD_LENGTH) Object.assign(parsed, { keyword })

  for (const key of STRING_FILTER_KEYS) {
    const value = params.get(key)
    const maxLength = key === 'level' ? 16 : 64
    if (value && value.length <= maxLength) Object.assign(parsed, { [key]: value })
  }

  const type = params.get('type')
  if (CUSTOMER_TYPES.includes(type as CustomerType)) Object.assign(parsed, { type })

  const poolStatus = params.get('poolStatus')
  if (POOL_STATUSES.includes(poolStatus as PoolStatus)) Object.assign(parsed, { poolStatus })

  const sortBy = params.get('sortBy')
  if (CUSTOMER_SORT_FIELDS.includes(sortBy as CustomerSortField)) Object.assign(parsed, { sortBy })

  const sortOrder = params.get('sortOrder')
  if (CUSTOMER_SORT_ORDERS.includes(sortOrder as CustomerSortOrder)) Object.assign(parsed, { sortOrder })

  for (const key of DATE_FILTER_KEYS) {
    const value = params.get(key)
    if (value && isValidDateTime(value)) Object.assign(parsed, { [key]: value })
  }

  for (const key of NUMBER_FILTER_KEYS) {
    const value = toPositiveInteger(params.get(key))
    if (value) Object.assign(parsed, { [key]: value })
  }

  return parsed
}

export function serializeCustomerWorkspaceQuery(query: CustomerWorkspaceQuery): string {
  const params = new URLSearchParams()
  params.set('view', query.view)
  params.set('page', String(query.page))
  params.set('pageSize', String(query.pageSize))

  for (const key of STRING_FILTER_KEYS) {
    const value = query[key]
    if (value) params.set(key, value)
  }

  if (query.keyword) params.set('keyword', query.keyword)
  if (query.type) params.set('type', query.type)
  if (query.poolStatus) params.set('poolStatus', query.poolStatus)
  if (query.sortBy) params.set('sortBy', query.sortBy)
  if (query.sortOrder) params.set('sortOrder', query.sortOrder)

  for (const key of DATE_FILTER_KEYS) {
    const value = query[key]
    if (value) params.set(key, value)
  }

  for (const key of NUMBER_FILTER_KEYS) {
    const value = query[key]
    if (value) params.set(key, String(value))
  }

  if (query.customerId) params.set('customerId', String(query.customerId))
  return params.toString()
}

export function toCustomerListQuery(query: CustomerWorkspaceQuery): CustomerListQuery {
  const {
    customerId: _customerId,
    view,
    collaboratorUserId,
    tagId,
    createdAtFrom,
    createdAtTo,
    lastFollowUpAtFrom,
    lastFollowUpAtTo,
    nextFollowUpAtFrom,
    nextFollowUpAtTo,
    ...filters
  } = query
  const apiQuery: CustomerListQuery = {
    ...filters,
    ...(collaboratorUserId ? { collaboratorId: collaboratorUserId } : {}),
    ...(tagId ? { tagIds: [tagId] } : {}),
    ...(createdAtFrom ? { createdFrom: createdAtFrom } : {}),
    ...(createdAtTo ? { createdTo: createdAtTo } : {}),
    ...(lastFollowUpAtFrom ? { lastFollowUpFrom: lastFollowUpAtFrom } : {}),
    ...(lastFollowUpAtTo ? { lastFollowUpTo: lastFollowUpAtTo } : {}),
    ...(nextFollowUpAtFrom ? { nextFollowUpFrom: nextFollowUpAtFrom } : {}),
    ...(nextFollowUpAtTo ? { nextFollowUpTo: nextFollowUpAtTo } : {}),
  }

  if (view === 'important') {
    return { ...apiQuery, view: 'all', level: apiQuery.level ?? 'important' }
  }

  return { ...apiQuery, view }
}
