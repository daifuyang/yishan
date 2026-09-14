import type { CustomerSortField, CustomerType, PoolStatus } from '@/services/crm'
import type { CustomerStatusCode } from '../../domain/statuses'

export type CustomerViewId = 'all' | 'mine' | 'pending' | 'important' | 'pool'

export interface CustomerWorkspaceFilters {
  keyword?: string
  statusCode?: CustomerStatusCode
  sourceId?: number
  level?: string
  type?: CustomerType
  industry?: string
  ownerUserId?: number
  collaboratorUserId?: number
  tagId?: number
  poolStatus?: PoolStatus
  createdAtFrom?: string
  createdAtTo?: string
  lastFollowUpAtFrom?: string
  lastFollowUpAtTo?: string
  nextFollowUpAtFrom?: string
  nextFollowUpAtTo?: string
  sortBy?: CustomerSortField
  sortOrder?: 'asc' | 'desc'
}

export interface CustomerWorkspaceQuery extends CustomerWorkspaceFilters {
  view: CustomerViewId
  page: number
  pageSize: number
  customerId?: number
}

export interface CustomerStage {
  id: string
  name: string
  sort: number
}

export interface CustomerWorkspaceUnavailableCapability {
  available: false
  reason: 'unavailable'
}

export type CustomerWorkspaceStatsCapability = CustomerWorkspaceUnavailableCapability
export type CustomerStagePipelineCapability = CustomerWorkspaceUnavailableCapability
