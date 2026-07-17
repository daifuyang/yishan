/**
 * PAT 与 super_admin 交集逻辑测试
 *
 * 直接覆盖 computeEffectivePerms(rolePerms, tokenScope, activeCodes) 的所有分支：
 *   1. JWT/cookie 普通登录（tokenScope === undefined）→ effective = rolePerms
 *   2. PAT 通配符（tokenScope.includes('*')）→ effective = rolePerms（含 bypass，受 activeCodes 限制）
 *   3. PAT 显式空 scopes → effective = ∅（拒绝一切）
 *   4. PAT 非空 scopes → rolePerms ∩ tokenScope（含 bypass，受 activeCodes 限制）
 *
 * 新方案约束（2026-07-14）：
 *   - activeCodes 不包含 SUPER_ADMIN_BYPASS（它是内部 sentinel）
 *   - isActiveForPat() 允许 sentinel 绕过 activeCodes 过滤
 *   - 所有测试都按此约束模拟真实 Catalog
 */

import { describe, expect, it } from "vitest";
import {
  computeEffectivePerms,
} from "../src/core/plugins/external/rbac.ts";
import {
  SUPER_ADMIN_BYPASS,
  PAT_WILDCARD,
} from "../src/constants/permission-codes.js";

// ============================================================================
// Test fixtures — activeCodes 不包含 SUPER_ADMIN_BYPASS
// 这是新方案的核心约束：sentinel 不在活动权限目录中
// ============================================================================

// 业务权限目录（不含 sentinel）
const BUSINESS_CODES = new Set([
  "system:user:list",
  "system:role:list",
  "shop:product:list",
]);

// Core 权限目录（不含插件权限）
const CORE_ONLY_CODES = new Set([
  "system:user:list",
  "system:role:list",
]);

// 空活动目录（所有插件都禁用）
const EMPTY_CODES = new Set<string>();

describe("RBAC: computeEffectivePerms", () => {
  // =========================================================================
  // Case 1: JWT/cookie 普通登录
  // =========================================================================

  it("普通 JWT 登录：无 tokenScope，effective == rolePerms", () => {
    const rolePerms = new Set(["system:user:list", "system:role:list"]);
    // JWT 登录不需要 activeCodes 参数
    const result = computeEffectivePerms(rolePerms, undefined, EMPTY_CODES);
    expect(result).toEqual(rolePerms);
  });

  it("超级管理员 JWT 登录：保留 super_admin bypass", () => {
    const rolePerms = new Set(["system:user:list", SUPER_ADMIN_BYPASS]);
    const result = computeEffectivePerms(rolePerms, undefined, EMPTY_CODES);
    expect(result.has("system:user:list")).toBe(true);
    expect(result.has(SUPER_ADMIN_BYPASS)).toBe(true);
    expect(result.size).toBe(2);
  });

  // =========================================================================
  // Case 2: PAT 通配符
  // =========================================================================

  it("PAT 通配符：保留 rolePerms 和 bypass，受活动目录限制", () => {
    const rolePerms = new Set([
      "system:user:list",
      "system:role:list",
      SUPER_ADMIN_BYPASS,
    ]);
    const result = computeEffectivePerms(rolePerms, [PAT_WILDCARD], BUSINESS_CODES);
    expect(result.has("system:user:list")).toBe(true);
    expect(result.has("system:role:list")).toBe(true);
    expect(result.has(SUPER_ADMIN_BYPASS)).toBe(true);
    expect(result.size).toBe(3);
  });

  it("PAT 通配符 + 非活动插件权限：禁用插件的权限不生效，bypass 保留", () => {
    const rolePerms = new Set([
      "system:user:list",
      "plugin:disabled:action",
      SUPER_ADMIN_BYPASS,
    ]);
    // CORE_ONLY_CODES 不含 plugin:disabled:action
    const result = computeEffectivePerms(rolePerms, [PAT_WILDCARD], CORE_ONLY_CODES);
    expect(result.has("system:user:list")).toBe(true);
    expect(result.has(SUPER_ADMIN_BYPASS)).toBe(true);
    expect(result.has("plugin:disabled:action")).toBe(false); // 禁用插件的权限不生效
    expect(result.size).toBe(2);
  });

  it("PAT 通配符 + 空活动目录：仅保留 bypass（rolePerms 中有）", () => {
    const rolePerms = new Set([
      "shop:product:list",
      SUPER_ADMIN_BYPASS,
    ]);
    // 所有插件都禁用
    const result = computeEffectivePerms(rolePerms, [PAT_WILDCARD], EMPTY_CODES);
    expect(result.has("shop:product:list")).toBe(false);
    expect(result.has(SUPER_ADMIN_BYPASS)).toBe(true); // bypass 不受活动目录限制
    expect(result.size).toBe(1);
  });

  it("PAT 通配符 + 空活动目录 + 无 bypass：空集", () => {
    const rolePerms = new Set(["shop:product:list"]);
    const result = computeEffectivePerms(rolePerms, [PAT_WILDCARD], EMPTY_CODES);
    expect(result.size).toBe(0);
  });

  // =========================================================================
  // Case 3: 显式空 scopes
  // =========================================================================

  it("PAT 显式空 scopes：effective 为空集（即便 super_admin 也拒绝）", () => {
    const rolePerms = new Set(["system:user:list", SUPER_ADMIN_BYPASS]);
    const result = computeEffectivePerms(rolePerms, [], CORE_ONLY_CODES);
    expect(result.size).toBe(0);
    expect(result.has(SUPER_ADMIN_BYPASS)).toBe(false);
  });

  // =========================================================================
  // Case 4: 严格交集
  // =========================================================================

  it("普通用户 + 普通 scopes：严格交集", () => {
    const rolePerms = new Set(["system:user:list", "system:role:list"]);
    const result = computeEffectivePerms(rolePerms, ["system:user:list"], CORE_ONLY_CODES);
    expect(result.has("system:user:list")).toBe(true);
    expect(result.has("system:role:list")).toBe(false);
    expect(result.size).toBe(1);
  });

  it("普通用户 + 完全无关 scopes：交集为空", () => {
    const rolePerms = new Set(["system:user:list"]);
    const result = computeEffectivePerms(rolePerms, ["shop:product:list"], BUSINESS_CODES);
    expect(result.size).toBe(0);
  });

  it("super_admin + 受限 scopes（不含 *）：super_admin 旁路被剥离", () => {
    const rolePerms = new Set([
      "system:user:list",
      "system:role:list",
      "shop:product:list",
      SUPER_ADMIN_BYPASS,
    ]);
    const result = computeEffectivePerms(rolePerms, ["system:user:list"], BUSINESS_CODES);
    // scope 是严格上限，super_admin 旁路不因 rolePerms 含旁路就自动保留
    expect(result.has("system:user:list")).toBe(true);
    expect(result.has("system:role:list")).toBe(false);
    expect(result.has(SUPER_ADMIN_BYPASS)).toBe(false);
    expect(result.size).toBe(1);
  });

  it("super_admin + ['__super_admin__']：旁路生效", () => {
    const rolePerms = new Set([SUPER_ADMIN_BYPASS]);
    // 传入不含 sentinel 的活动目录
    const result = computeEffectivePerms(rolePerms, [SUPER_ADMIN_BYPASS], CORE_ONLY_CODES);
    expect(result.has(SUPER_ADMIN_BYPASS)).toBe(true);
    expect(result.size).toBe(1);
  });

  it("非 super_admin + ['__super_admin__']：旁路不会自动获得", () => {
    const rolePerms = new Set(["system:user:list"]);
    // 传入不含 sentinel 的活动目录
    const result = computeEffectivePerms(rolePerms, [SUPER_ADMIN_BYPASS], CORE_ONLY_CODES);
    // rolePerms 不含 __super_admin__ → 交集后旁路不会凭空出现
    expect(result.has(SUPER_ADMIN_BYPASS)).toBe(false);
    expect(result.size).toBe(0);
  });

  it("super_admin + 普通 scopes：super_admin 旁路被剥离", () => {
    const rolePerms = new Set([SUPER_ADMIN_BYPASS, "system:user:list"]);
    const result = computeEffectivePerms(rolePerms, ["system:user:list"], BUSINESS_CODES);
    // scope 是严格上限，交集中不含 __super_admin__，旁路被剥离
    expect(result.has(SUPER_ADMIN_BYPASS)).toBe(false);
    expect(result.has("system:user:list")).toBe(true);
    expect(result.size).toBe(1);
  });

  it("super_admin + 空 rolePerms + tokenScope 包含旁路：旁路仍生效", () => {
    // 极端场景：rolePerms 只剩旁路（cache 清空后第一次加载），scopes 显式包含旁路
    const rolePerms = new Set<string>([SUPER_ADMIN_BYPASS]);
    // 传入不含 sentinel 的活动目录
    const result = computeEffectivePerms(rolePerms, [SUPER_ADMIN_BYPASS], CORE_ONLY_CODES);
    expect(result.has(SUPER_ADMIN_BYPASS)).toBe(true);
  });

  it("PAT scope 不可超出 rolePerms（权限不会因 tokenScope 而扩大）", () => {
    // 用户只有 system:user:list，tokenScope 申请了 system:role:list（用户没有的权限）
    const rolePerms = new Set(["system:user:list"]);
    const result = computeEffectivePerms(rolePerms, ["system:user:list", "system:role:list"], CORE_ONLY_CODES);
    // system:role:list 不在 rolePerms 中，不会因 tokenScope 申请就获得
    expect(result.has("system:role:list")).toBe(false);
    expect(result.has("system:user:list")).toBe(true);
    expect(result.size).toBe(1);
  });

  // =========================================================================
  // 新方案约束测试（2026-07-14）：文档必测用例
  // =========================================================================

  it("必测用例：{user:list, __super_admin__} + ['*'] + {user:list} → 包含两者", () => {
    const rolePerms = new Set(["user:list", SUPER_ADMIN_BYPASS]);
    const result = computeEffectivePerms(rolePerms, [PAT_WILDCARD], new Set(["user:list"]));
    expect(result.has("user:list")).toBe(true);
    expect(result.has(SUPER_ADMIN_BYPASS)).toBe(true);
    expect(result.size).toBe(2);
  });

  it("必测用例：{user:list, __super_admin__} + ['user:list'] + {user:list} → 仅 user:list", () => {
    const rolePerms = new Set(["user:list", SUPER_ADMIN_BYPASS]);
    const result = computeEffectivePerms(rolePerms, ["user:list"], new Set(["user:list"]));
    expect(result.has("user:list")).toBe(true);
    expect(result.has(SUPER_ADMIN_BYPASS)).toBe(false);
    expect(result.size).toBe(1);
  });

  it("必测用例：{user:list, __super_admin__} + ['__super_admin__'] + {user:list} → 仅 __super_admin__", () => {
    const rolePerms = new Set(["user:list", SUPER_ADMIN_BYPASS]);
    const result = computeEffectivePerms(rolePerms, [SUPER_ADMIN_BYPASS], new Set(["user:list"]));
    expect(result.has("user:list")).toBe(false);
    expect(result.has(SUPER_ADMIN_BYPASS)).toBe(true);
    expect(result.size).toBe(1);
  });

  it("必测用例：{shop:list, __super_admin__} + ['*'] + {} → 仅 __super_admin__", () => {
    const rolePerms = new Set(["shop:list", SUPER_ADMIN_BYPASS]);
    const result = computeEffectivePerms(rolePerms, [PAT_WILDCARD], EMPTY_CODES);
    expect(result.has("shop:list")).toBe(false);
    expect(result.has(SUPER_ADMIN_BYPASS)).toBe(true);
    expect(result.size).toBe(1);
  });

  it("必测用例：{shop:list} + ['*'] + {} → 空集", () => {
    const rolePerms = new Set(["shop:list"]);
    const result = computeEffectivePerms(rolePerms, [PAT_WILDCARD], EMPTY_CODES);
    expect(result.size).toBe(0);
  });

  it("必测用例：{user:list} + ['__super_admin__'] + {user:list} → 空集", () => {
    const rolePerms = new Set(["user:list"]);
    const result = computeEffectivePerms(rolePerms, [SUPER_ADMIN_BYPASS], new Set(["user:list"]));
    expect(result.size).toBe(0);
  });

  // =========================================================================
  // 非活动插件权限测试
  // =========================================================================

  it("非活动插件 scope：不在 activeCodes 中不生效", () => {
    // 用户拥有 shop:product:list，且申请了该权限
    const rolePerms = new Set(["system:user:list", "shop:product:list", "plugin:custom:action"]);
    // 但 "plugin:custom:action" 不在活动权限目录中（插件已禁用）
    const result = computeEffectivePerms(
      rolePerms,
      ["system:user:list", "plugin:custom:action"],
      CORE_ONLY_CODES,
    );
    // 只有在活动目录中的 scope 才生效
    expect(result.has("system:user:list")).toBe(true);
    expect(result.has("plugin:custom:action")).toBe(false);
    expect(result.has("shop:product:list")).toBe(false);
  });

  it("活动插件 scope：tokenScope 在活动目录中才生效", () => {
    const rolePerms = new Set(["system:user:list", "shop:product:list"]);
    const result = computeEffectivePerms(
      rolePerms,
      ["system:user:list", "shop:product:list"],
      BUSINESS_CODES,
    );
    expect(result.has("system:user:list")).toBe(true);
    expect(result.has("shop:product:list")).toBe(true);
    expect(result.size).toBe(2);
  });

  it("通配符 * 受活动目录限制：禁用插件权限不因通配符而恢复", () => {
    // 即便使用通配符，禁用插件的权限也不会生效
    const rolePerms = new Set(["system:user:list", "plugin:disabled:action", SUPER_ADMIN_BYPASS]);
    const result = computeEffectivePerms(rolePerms, [PAT_WILDCARD], CORE_ONLY_CODES);
    // 通配符继承 rolePerms，但必须与活动目录相交
    expect(result.has("system:user:list")).toBe(true);
    expect(result.has(SUPER_ADMIN_BYPASS)).toBe(true);
    expect(result.has("plugin:disabled:action")).toBe(false); // 禁用插件的权限不生效
    expect(result.size).toBe(2);
  });

  it("插件禁用后：同一 Token 内其他活动 scope 保持有效", () => {
    // Token 包含多个 scope，其中部分来自已禁用插件
    const rolePerms = new Set([
      "system:user:list",
      "shop:product:list",
      "plugin:disabled:action",
    ]);
    // 活动目录中只有 system:user:list 和 shop:product:list
    const result = computeEffectivePerms(
      rolePerms,
      ["system:user:list", "shop:product:list", "plugin:disabled:action"],
      new Set(["system:user:list", "shop:product:list"]),
    );
    // 已禁用插件的 scope 失效，但其他 scope 保持有效
    expect(result.has("system:user:list")).toBe(true);
    expect(result.has("shop:product:list")).toBe(true);
    expect(result.has("plugin:disabled:action")).toBe(false);
    expect(result.size).toBe(2);
  });
});
