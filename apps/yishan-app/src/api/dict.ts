/**
 * 字典 API
 */
import { request } from './client'
import type { DictItem } from './types'

export function getDictByType(type: string) {
  return request<DictItem[]>({
    method: 'GET',
    path: `/api/v1/app/dicts/${encodeURIComponent(type)}`,
  })
}

export function getAllDictMap() {
  return request<Record<string, { label: string; value: string }[]>>({
    method: 'GET',
    path: '/api/v1/app/dicts/',
  })
}
