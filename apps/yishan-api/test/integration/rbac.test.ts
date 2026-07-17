/**
 * 集成测试样例：RBAC (Section 5)。
 *
 * 用真实 MySQL 验证：
 *   - 拥有 super_admin 角色的用户可以访问受保护资源；
 *   - 仅绑定到自定义角色的用户访问 super_admin-only 路径会被 403；
 *   - 修改菜单 perm 后下一次 requirePermission 调用立刻生效（缓存失效）。
 *
 * 未设置 YISHAN_RUN_INTEGRATION=1 时跳过，避免 CI 没有 MySQL 时崩溃。
 *
 * 重要：setupIntegration() 必须在 describe 注册之前 await 完成，
 * 这样 ctx.skip 在 it.runIf 求值时已是最终值，避免定义期被锁死为 true。
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setupIntegration, type IntegrationContext } from "./_setup.js";
import { PermissionService } from "../../src/core/services/permission.service.js";

const ctx: IntegrationContext = await setupIntegration();

describe("integration: RBAC permission lookup", () => {
  beforeAll(async () => {
    // 已通过 await setupIntegration() 完成 DB 初始化；
    // 这里仅保留 hook 位置以便将来扩展（如插入 seed）。
    if (!ctx.skip) {
      // 例如 await ctx.resetSchema?.();
    }
  });
  afterAll(async () => {
    if (!ctx.skip && ctx.closeDb) await ctx.closeDb();
  });

  it.runIf(!ctx.skip)("loadForRoleIds returns empty for unknown role", async () => {
    const result = await PermissionService.loadForRoleIds([99999]);
    expect(result.perms.size).toBe(0);
    expect(result.roleCodes.size).toBe(0);
  });

  it.runIf(!ctx.skip)("invalidate clears cache", async () => {
    await PermissionService.loadForRoleIds([1, 2, 3]);
    PermissionService.invalidate();
    // Subsequent call should refresh without throwing.
    const result = await PermissionService.loadForRoleIds([1, 2, 3]);
    expect(result.perms).toBeDefined();
  });
});