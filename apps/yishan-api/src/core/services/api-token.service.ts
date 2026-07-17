/**
 * API Token Service
 *
 * 业务编排：duration/expiresAt 互斥校验、默认值回退、scopes 默认值、映射 DTO、
 * 抛业务异常。持久化全部走 ApiTokenRepository。
 *
 * PAT scopes 语义（单一策略，与 rbac.ts 保持一致）：
 *   - 不传 scopes → 创建空 scopes（无任何资源授权，安全默认）
 *   - 传入空数组 []  → 等同不传
 *   - 传入字符串数组 → 写入数据库，未知 permission code 直接抛错（不再静默丢弃）
 *
 * PAT 特殊 sentinels：
 *   - "*"            → 完全继承用户角色权限（含 super_admin 旁路，需管理员主动选择）
 *   - "__super_admin__" → 仅当用户角色权限中包含旁路时才生效，不会凭空授予
 *   - 其他 code      → 必须是 PERMISSION_CODES 中已登记的或运行时 manifest 注册的
 *
 * super_admin bypass 规则：
 *   - 旁路不会因 rolePerms 包含就自动保留，必须在 tokenScope 中显式出现
 *   - 空 scopes 一律拒绝，即便 rolePerms 含 super_admin 旁路
 */

import { ApiTokenRepository } from "../repositories/api-token.repository.js";
import { ApiTokenMapper, type ApiTokenCreateResp, type ApiTokenRecordResp } from "../mappers/api-token.mapper.js";
import { AuthErrorCode } from "../../constants/business-codes/auth.js";
import { ValidationErrorCode } from "../../constants/business-codes/validation.js";
import { BusinessError } from "../../exceptions/business-error.js";
import {
  normalizeApiTokenScopes,
  PAT_WILDCARD,
  ROLE_CODES,
  SUPER_ADMIN_BYPASS,
} from "../../constants/permission-codes.js";
import { PermissionService } from "./permission.service.js";
import { getGlobalCatalog } from "./permission-catalog.service.js";

// ============================================================================
// Duration handling (moved from route)
// ============================================================================

export type ApiTokenDuration = "7d" | "30d" | "60d" | "90d" | "1y" | "never";

const DURATION_DAYS: Record<Exclude<ApiTokenDuration, "never">, number> = {
  "7d": 7,
  "30d": 30,
  "60d": 60,
  "90d": 90,
  "1y": 365,
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Translate a preset duration string to an absolute Date, or null for "never". */
function durationToExpiresAt(duration: ApiTokenDuration): Date | null {
  if (duration === "never") return null;
  return new Date(Date.now() + DURATION_DAYS[duration] * DAY_MS);
}

// ============================================================================
// Grantable Scope Codes (pure authorization data)
// ============================================================================

/**
 * 用户可授予的权限范围（纯授权数据，不含 UI 分组信息）。
 * 用于 Token 创建时的安全校验，不依赖展示 DTO。
 *
 * 语义：
 * - `codes`: 用户角色持有的且在活动权限目录中的业务权限集合；
 *   若角色拥有 `SUPER_ADMIN_BYPASS`，该 sentinel 也会被放入 `codes`，
 *   供创建校验和特殊展示项判断使用。
 * - `isSuperAdmin`: 用户是否拥有超级管理员角色（决定能否使用 `*` 通配符）
 *
 * `SUPER_ADMIN_BYPASS` 不属于 catalog 业务权限，但可作为 sentinel 进入 `codes`，
 * 不进入 `activeCodes` 也不进入 catalog。
 */
export interface GrantableScopeCodes {
  codes: Set<string>;
  isSuperAdmin: boolean;
}

/**
 * 获取用户可授予的权限范围。
 * 仅依赖纯授权数据（角色权限 + 活动权限目录），不依赖 UI 的 group/label/description。
 */
export async function getGrantableScopeCodes(userId: number): Promise<GrantableScopeCodes> {
  const roleIds = await PermissionService.loadRoleIdsForUser(userId);
  const { perms, roleCodes } = await PermissionService.loadForRoleIds(roleIds);
  const activeCodes = await getGlobalCatalog().getActiveCodes();

  // 过滤：只保留在活动权限目录中的业务权限
  // SUPER_ADMIN_BYPASS 不在 activeCodes 中，但它是 sentinel，不需要过滤
  const codes = new Set<string>(
    [...perms].filter((code) => code === SUPER_ADMIN_BYPASS || activeCodes.has(code)),
  );

  return {
    codes,
    isSuperAdmin: roleCodes.has(ROLE_CODES.SUPER_ADMIN),
  };
}

// ============================================================================
// Service
// ============================================================================

export class ApiTokenService {
  /**
   * Create a new API token for the given user.
   * duration / expiresAt are mutually exclusive; if neither is given, defaults to "30d".
   * scopes 不传/空数组 → 创建空 scopes；显式传入时校验授权范围。
   *
   * Token 创建校验规则（纯授权数据，不依赖 UI DTO）：
   *   - scope === '*': 要求 isSuperAdmin === true
   *   - scope === '__super_admin__': 要求 grantableCodes 包含该旁路
   *   - 其他 scope: 要求 grantableCodes 包含该权限
   *   - 非活动插件权限由 getGrantableScopeCodes 自动过滤
   */
  static async createToken(
    userId: number,
    req: {
      name: string;
      duration?: ApiTokenDuration;
      expiresAt?: string;
      scopes?: string[];
    },
  ): Promise<ApiTokenCreateResp> {
    // Mutual exclusion: duration and expiresAt cannot be set together.
    if (req.duration && req.expiresAt) {
      throw new BusinessError(
        ValidationErrorCode.INVALID_PARAMETER,
        "duration 与 expiresAt 不能同时指定",
      );
    }

    let expiresAt: Date | null;
    if (req.duration) {
      expiresAt = durationToExpiresAt(req.duration);
    } else if (req.expiresAt) {
      const d = new Date(req.expiresAt);
      if (isNaN(d.getTime())) {
        throw new BusinessError(
          ValidationErrorCode.PARAMETER_FORMAT_ERROR,
          "expiresAt 格式无效",
        );
      }
      expiresAt = d;
    } else {
      // Default: 30 days.
      expiresAt = durationToExpiresAt("30d");
    }

    // scopes 默认为空；显式传入时通过 normalizeApiTokenScopes 校验：
    //   - 保留 "*"（通配符）、"__super_admin__"（super admin 显式旁路）、所有已登记 code
    //   - 未知 code 直接抛 BusinessError（防止静默配置失误）
    const normalizedScopes: string[] = normalizeApiTokenScopes(req.scopes);

    // 使用纯授权数据校验 scopes
    if (normalizedScopes.length > 0) {
      const { codes: grantableCodes, isSuperAdmin } = await getGrantableScopeCodes(userId);

      for (const scope of normalizedScopes) {
        if (scope === PAT_WILDCARD) {
          // `*` 通配符仅限超级管理员
          if (!isSuperAdmin) {
            throw new BusinessError(
              ValidationErrorCode.INVALID_PARAMETER,
              "通配符 * 仅限超级管理员使用",
            );
          }
        } else if (scope === SUPER_ADMIN_BYPASS) {
          // `__super_admin__` 需要用户角色原本拥有该旁路
          if (!grantableCodes.has(SUPER_ADMIN_BYPASS)) {
            throw new BusinessError(
              ValidationErrorCode.INVALID_PARAMETER,
              "超级管理员旁路权限不在您的授权范围内",
            );
          }
        } else {
          // 普通权限必须在用户授权范围内
          // 非活动插件权限不在 grantableCodes 中，会自动被拒绝
          if (!grantableCodes.has(scope)) {
            throw new BusinessError(
              ValidationErrorCode.INVALID_PARAMETER,
              `权限 ${scope} 不在您的授权范围内`,
            );
          }
        }
      }
    }

    const result = await ApiTokenRepository.create({
      userId,
      name: req.name,
      expiresAt,
      scopes: normalizedScopes,
    });

    return ApiTokenMapper.toCreateResp(result);
  }

  /** List all non-deleted tokens owned by the given user. */
  static async listTokens(userId: number): Promise<{ list: ApiTokenRecordResp[]; total: number }> {
    const rows = await ApiTokenRepository.listByUser(userId);
    return {
      list: rows.map(ApiTokenMapper.toRecordResp),
      total: rows.length,
    };
  }

  /** Find a token by id, scoped to the owning user. Throws if not found. */
  static async getToken(userId: number, id: number): Promise<ApiTokenRecordResp> {
    const row = await ApiTokenRepository.findByIdForUser(id, userId);
    if (!row) {
      throw new BusinessError(AuthErrorCode.API_TOKEN_NOT_FOUND, "Token 不存在或已删除");
    }
    return ApiTokenMapper.toRecordResp(row);
  }

  /** Revoke a token owned by the given user. Throws if not found. */
  static async revokeToken(userId: number, id: number): Promise<{ id: number }> {
    const ok = await ApiTokenRepository.revoke(id, userId);
    if (!ok) {
      throw new BusinessError(AuthErrorCode.API_TOKEN_NOT_FOUND, "Token 不存在或已删除");
    }
    return { id };
  }
}

// ============================================================================
// Available Scopes Types
// ============================================================================

export type ScopeSystem = "system" | "shop" | "portal" | "special";

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

// ============================================================================
// Available Scopes Helpers
// ============================================================================

const SYSTEM_LABELS: Record<string, string> = {
  system: "系统管理",
  shop: "商城管理",
  portal: "门户管理",
  special: "特殊权限",
};

/**
 * 获取当前用户可授予的权限范围，按 system/shop/portal/special 分组。
 *
 * 严格展示适配器：本函数只消费 `getGrantableScopeCodes(userId)` 的结果与
 * 活动权限目录的展示元数据（label/description/group）。
 *
 * 不再调用 `PermissionService.loadRoleIdsForUser` /
 * `PermissionService.loadForRoleIds`；任何授权判断（catalog 过滤、
 * isSuperAdmin 判断、sentinel 展示条件）都必须由 `getGrantableScopeCodes`
 * 负责，避免创建校验与展示列表出现两套独立计算。
 *
 * 新方案约束（2026-07-14）：
 *   - 合并 Core 静态权限定义与活动插件 manifest 权限
 *   - 非活动插件权限不出现在 available-scopes
 *   - 固定 group 排序：`system` → `shop` → `portal` → `special`
 *   - 其他插件 group 按 catalog 出现顺序追加在 fixed groups 之后
 */
export async function getAvailableScopesForUser(userId: number): Promise<AvailableScopeGroup[]> {
  // Step 1: 获取纯授权数据 + 活动目录元数据
  const { codes: grantableCodes, isSuperAdmin } = await getGrantableScopeCodes(userId);
  const catalog = await getGlobalCatalog().getActiveCatalog();

  // Step 2: 一次遍历 catalog，按 group 收集授权允许的条目
  const fixedOrder: ScopeSystem[] = ["system", "shop", "portal", "special"];
  const fixedGroups = new Map<ScopeSystem, AvailableScopeItem[]>();
  const pluginGroups = new Map<string, AvailableScopeItem[]>();

  for (const item of catalog) {
    if (!grantableCodes.has(item.code)) continue;
    const option: AvailableScopeItem = {
      value: item.code,
      label: item.label,
      description: item.description,
    };
    if ((fixedOrder as string[]).includes(item.group)) {
      const bucket = fixedGroups.get(item.group as ScopeSystem) ?? [];
      bucket.push(option);
      fixedGroups.set(item.group as ScopeSystem, bucket);
    } else {
      const bucket = pluginGroups.get(item.group) ?? [];
      bucket.push(option);
      pluginGroups.set(item.group, bucket);
    }
  }

  // Step 3: 添加特殊权限（`*` 由 isSuperAdmin 决定；
  // `__super_admin__` 仅在 grantableCodes 含 sentinel 时展示）
  const specialOptions = fixedGroups.get("special") ?? [];
  if (isSuperAdmin) {
    specialOptions.push({
      value: PAT_WILDCARD,
      label: "通配符（继承全部权限）",
      description: "继承用户角色全部权限，包括 super_admin 旁路",
    });
  }
  if (grantableCodes.has(SUPER_ADMIN_BYPASS)) {
    specialOptions.push({
      value: SUPER_ADMIN_BYPASS,
      label: "超级管理员旁路",
      description: "仅保留 super_admin 旁路标记，无其他权限",
    });
  }
  if (specialOptions.length > 0) {
    fixedGroups.set("special", specialOptions);
  }

  // Step 4: 拼装响应 — 固定 group 按固定顺序输出，其他 group 按 catalog 出现顺序追加
  const result: AvailableScopeGroup[] = [];
  for (const system of fixedOrder) {
    const options = fixedGroups.get(system);
    if (options && options.length > 0) {
      result.push({
        label: SYSTEM_LABELS[system],
        system,
        options: options.sort((a, b) => a.label.localeCompare(b.label)),
      });
    }
  }

  for (const [group, options] of pluginGroups) {
    if (options.length === 0) continue;
    result.push({
      label: group,
      system: group as ScopeSystem,
      options: options.sort((a, b) => a.label.localeCompare(b.label)),
    });
  }

  return result;
}