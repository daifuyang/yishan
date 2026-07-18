import { request } from '@umijs/max';
export type ApiTokenDuration = '7d' | '30d' | '60d' | '90d' | '1y' | 'never';
export interface ApiTokenRecord { id: number; name: string; userId: number; expiresAt: string | null; lastUsedAt: string | null; lastUsedIp: string | null; createdAt: string; updatedAt: string; }
export interface ApiTokenCreateResponse extends ApiTokenRecord { token: string; }
export interface ApiTokenListResponse { list: ApiTokenRecord[]; total: number; }
export interface CreateMyApiTokenBody { name: string; duration?: ApiTokenDuration; scopes?: string[]; }
export type ScopeSystem = 'system' | 'shop' | 'portal' | 'special';
export interface AvailableScopeItem { value: string; label: string; description?: string; }
export interface AvailableScopeGroup { label: string; system: ScopeSystem; options: AvailableScopeItem[]; }
export async function listMyApiTokens(options?: any) { return request<any>('/api/v1/me/api-tokens', { method: 'GET', ...(options || {}) }); }
export async function getMyApiToken(id: number, options?: any) { return request<any>(`/api/v1/me/api-tokens/${id}`, { method: 'GET', ...(options || {}) }); }
export async function createMyApiToken(body: CreateMyApiTokenBody, options?: any) { return request<any>('/api/v1/me/api-tokens', { method: 'POST', headers: { 'Content-Type': 'application/json' }, data: body, ...(options || {}) }); }
export async function revokeMyApiToken(id: number, options?: any) { return request<any>(`/api/v1/me/api-tokens/${id}`, { method: 'DELETE', ...(options || {}) }); }
export async function listMyAvailableScopes(options?: any) { return request<any>('/api/v1/me/api-tokens/available-scopes', { method: 'GET', ...(options || {}) }); }
