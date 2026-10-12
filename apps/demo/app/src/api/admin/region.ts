import { request } from '../client'

export interface RegionNode {
  code: number
  name: string
  level: number
  parentCode: number
  sortOrder: number
  children?: RegionNode[]
}

export function getRegionTree() {
  return request<RegionNode[]>({ path: '/api/v1/admin/system/regions/tree', query: { level: 3 } })
}
