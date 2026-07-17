// @ts-ignore
/* eslint-disable */
import { request } from '@umijs/max';

export type ApiTokenDuration = '7d' | '30d' | '60d' | '90d' | '1y' | 'never';

export interface ApiTokenRecord {
  id: number;
  name: string;
  userId: number;
  expiresAt: string | null;
  lastUsedAt: string | null;
  lastUsedIp: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiTokenCreateResponse extends ApiTokenRecord {
  token: string;
}

export interface ApiTokenListResponse {
  list: ApiTokenRecord[];
  total: number;
}

export interface ApiTokenDeleteResponse {
  id: number;
}

export interface CreateMyApiTokenBody {
  name: string;
  duration?: ApiTokenDuration;
  scopes?: string[];
}

// ============================================================================
// Available Scopes Types (from API)
// ============================================================================

export type ScopeSystem = 'system' | 'shop' | 'portal' | 'special';

export interface AvailableScopeItem {
  value: string;
  label: string;
  description?: string;
}

export interface AvailableScopeGroup {
  label: string;
  system: ScopeSystem;
  options: AvailableScopeItem[];
}

export interface AvailableScopesResponse {
  groups: AvailableScopeGroup[];
}

export async function listMyApiTokens(options?: { [key: string]: any }) {
  return request<{
    success: boolean;
    code: number;
    message: string;
    data: ApiTokenListResponse;
    timestamp: string;
  }>('/api/v1/me/api-tokens', {
    method: 'GET',
    ...(options || {}),
  });
}

export async function getMyApiToken(
  id: number,
  options?: { [key: string]: any },
) {
  return request<{
    success: boolean;
    code: number;
    message: string;
    data: ApiTokenRecord;
    timestamp: string;
  }>(`/api/v1/me/api-tokens/${id}`, {
    method: 'GET',
    ...(options || {}),
  });
}

export async function createMyApiToken(
  body: CreateMyApiTokenBody,
  options?: { [key: string]: any },
) {
  return request<{
    success: boolean;
    code: number;
    message: string;
    data: ApiTokenCreateResponse;
    timestamp: string;
  }>('/api/v1/me/api-tokens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    data: body,
    ...(options || {}),
  });
}

export async function revokeMyApiToken(
  id: number,
  options?: { [key: string]: any },
) {
  return request<{
    success: boolean;
    code: number;
    message: string;
    data: ApiTokenDeleteResponse;
    timestamp: string;
  }>(`/api/v1/me/api-tokens/${id}`, {
    method: 'DELETE',
    ...(options || {}),
  });
}

/**
 * 获取当前用户可授予的权限范围（从 API 动态加载）
 */
export async function listMyAvailableScopes(options?: { [key: string]: any }) {
  return request<{
    success: boolean;
    code: number;
    message: string;
    data: AvailableScopesResponse;
    timestamp: string;
  }>('/api/v1/me/api-tokens/available-scopes', {
    method: 'GET',
    ...(options || {}),
  });
}
