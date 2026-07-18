import { request } from '@umijs/max';

const base = '/api/v1/admin/system/regions';
export async function getRegionTree(params?: { level?: number }) { return request(`${base}/tree`, { method: 'GET', params }); }
export async function getRegions(params?: { parentCode?: number }) { return request(`${base}/`, { method: 'GET', params }); }
