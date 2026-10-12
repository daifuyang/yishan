/**
 * API Token Mapper
 */

import { dateUtils } from "../../utils/date.js";
import type { ApiTokenRecord, ApiTokenWithRaw } from "../repositories/api-token.repository.js";

// ============================================================================
// Types
// ============================================================================

/** Public-facing response shape for a stored API Token record. */
export interface ApiTokenRecordResp {
  id: number;
  name: string;
  /** Section 2: 当前 PAT 的授权范围，空数组表示无任何权限。 */
  scopes: string[];
  userId: number;
  expiresAt: string | null;
  lastUsedAt: string | null;
  lastUsedIp: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Public-facing response shape for the one-time create response. */
export interface ApiTokenCreateResp {
  id: number;
  name: string;
  scopes: string[];
  userId: number;
  expiresAt: string | null;
  createdAt: string;
  token: string;
}

// ============================================================================
// Mapper
// ============================================================================

export class ApiTokenMapper {
  static toRecordResp(row: ApiTokenRecord): ApiTokenRecordResp {
    return {
      id: row.id,
      name: row.name,
      scopes: row.scopes ?? [],
      userId: row.userId,
      expiresAt: row.expiresAt ? dateUtils.formatISO(row.expiresAt) : null,
      lastUsedAt: row.lastUsedAt ? dateUtils.formatISO(row.lastUsedAt) : null,
      lastUsedIp: row.lastUsedIp,
      createdAt: dateUtils.formatISO(row.createdAt)!,
      updatedAt: dateUtils.formatISO(row.updatedAt)!,
    };
  }

  static toCreateResp(record: ApiTokenWithRaw): ApiTokenCreateResp {
    return {
      id: record.id,
      name: record.name,
      scopes: record.scopes ?? [],
      userId: record.userId,
      expiresAt: record.expiresAt ? dateUtils.formatISO(record.expiresAt) : null,
      createdAt: dateUtils.formatISO(record.createdAt)!,
      token: record.raw,
    };
  }
}