import type { CustomerListQuery } from '@/services/crm'
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

const STRING_FILTER_KEYS: Array<keyof Pick<
  CustomerWorkspaceFilters,
  | 'keyword'
  | 'level'
  | 'type'
  | 'industry'
  | 'poolStatus'
  | 'createdAtFrom'
  | 'createdAtTo'
  | 'lastFollowUpAtFrom'
  | 'lastFollowUpAtTo'
  | 'nextFollowUpAtFrom'
  | 'nextFollowUpAtTo'
  | 'sortBy'
  | 'sortOrder'
>> = [
  'keyword',
  'level',
  'type',
  'industry',
  'poolStatus',
  'createdAtFrom',
  'createdAtTo',
  'lastFollowUpAtFrom',
  'lastFollowUpAtTo',
  'nextFollowUpAtFrom',
  'nextFollowUpAtTo',
  'sortBy',
  'sortOrder',
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

function getParams(search: string | URLSearchParams): URLSearchParams {
  return typeof search === 'string' ? new URLSearchParams(search) : search
}

export function parseCustomerWorkspaceQuery(search: string | URLSearchParams): CustomerWorkspaceQuery {
  const params = getParams(search)
  const view = params.get('view')
  const parsed: CustomerWorkspaceQuery = {
    view: CUSTOMER_VIEWS.includes(view as CustomerViewId) ? (view as CustomerViewId) : DEFAULT_QUERY.view,
    page: toPositiveInteger(params.get('page')) ?? DEFAULT_QUERY.page,
    pageSize: toPositiveInteger(params.get('pageSize')) ?? DEFAULT_QUERY.pageSize,
  }

  const customerId = toPositiveInteger(params.get('customerId'))
  if (customerId) parsed.customerId = customerId

  for (const key of STRING_FILTER_KEYS) {
    const value = params.get(key)
    if (value) Object.assign(parsed, { [key]: value })
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

  for (const key of NUMBER_FILTER_KEYS) {
    const value = query[key]
    if (value) params.set(key, String(value))
  }

  if (query.customerId) params.set('customerId', String(query.customerId))
  return params.toString()
}

export function toCustomerListQuery(query: CustomerWorkspaceQuery): CustomerListQuery {
  const { customerId: _customerId, view, ...filters } = query

  if (view === 'important') {
    return { ...filters, view: 'all', level: filters.level ?? 'important' }
  }

  return { ...filters, view }
}
