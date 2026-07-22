/**
 * ApiTokenService 单元测试
 *
 * 重点覆盖 scopes 标准化逻辑和授权校验：
 *   - 未传 / 空数组 → 写入 []
 *   - "*" → 仅超级管理员可使用
 *   - "__super_admin__" → 仅当用户角色拥有旁路时可用
 *   - 已知 permission code → 仅当用户在角色中拥有时可用
 *   - 未知 code → 抛 BusinessError INVALID_PARAMETER
 *   - duration / expiresAt 互斥校验
 *   - 默认 30d 过期
 *
 * 新方案约束（2026-07-14）：
 *   - Token 创建校验使用 getGrantableScopeCodes，不依赖 getAvailableScopesForUser 的 DTO
 *   - SUPER_ADMIN_BYPASS 不在活动权限目录中（它是 sentinel，不走 catalog 注册）
 *   - 测试环境由 test/setup.ts 在 beforeAll 里 force-import 所有 routes 完成 catalog 注册；
 *     因此本文件无需再 mock catalog，直接读取真实 PERMISSION_CODES / listPermissions 即可。
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiTokenService, getAvailableScopesForUser } from "../src/core/services/api-token.service.js";
import { ApiTokenRepository } from "../src/core/repositories/api-token.repository.js";
import { PermissionService } from "../src/core/services/permission.service.js";
import { ValidationErrorCode } from "../src/constants/business-codes/validation.js";
import { SUPER_ADMIN_BYPASS } from "../src/constants/permission-codes.js";

// ============================================================================
// Mock helpers
// ============================================================================

// SUPER_ADMIN_BYPASS 是 sentinel，rolePerms 可包含它，但 catalog 不注册它。
// 真实 catalog 由 setup.ts 在 beforeAll 完成注册；本文件不再 mock catalog API。

// Helper to mock super admin user (rolePerms 含 SUPER_ADMIN_BYPASS，roleCodes 含 super_admin)
function mockSuperAdminUser() {
  vi.spyOn(PermissionService, "loadRoleIdsForUser").mockResolvedValueOnce([1]);
  vi.spyOn(PermissionService, "loadForRoleIds").mockResolvedValueOnce({
    perms: new Set(["system:user:list", "system:role:list", SUPER_ADMIN_BYPASS]),
    roleCodes: new Set(["super_admin"]),
  });
}

// Helper to mock normal user with specific permissions
function mockNormalUser(perms: string[]) {
  vi.spyOn(PermissionService, "loadRoleIdsForUser").mockResolvedValueOnce([2]);
  vi.spyOn(PermissionService, "loadForRoleIds").mockResolvedValueOnce({
    perms: new Set(perms),
    roleCodes: new Set(["normal_user"]),
  });
}

// Helper to mock user with no permissions
function mockUserWithNoPerms() {
  vi.spyOn(PermissionService, "loadRoleIdsForUser").mockResolvedValueOnce([3]);
  vi.spyOn(PermissionService, "loadForRoleIds").mockResolvedValueOnce({
    perms: new Set([]),
    roleCodes: new Set([]),
  });
}

// Helper to mock scenario where user holds a code that is NOT in the active catalog
// (e.g. a disabled plugin's permission). Normalization rejects such codes before
// the grantable-codes check ever runs, so the assertion is on the normalize error.
function mockUserWithDisabledPluginPerm() {
  vi.spyOn(PermissionService, "loadRoleIdsForUser").mockResolvedValueOnce([4]);
  vi.spyOn(PermissionService, "loadForRoleIds").mockResolvedValueOnce({
    perms: new Set(["system:user:list", "shop:product:list"]),
    roleCodes: new Set(["normal_user"]),
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("ApiTokenService.createToken — scope normalization", () => {
  it("不传 scopes → 写入 []", async () => {
    const spy = vi
      .spyOn(ApiTokenRepository, "create")
      .mockResolvedValueOnce({} as any);

    await ApiTokenService.createToken(1, { name: "no-scopes" });

    const arg = spy.mock.calls[0][0];
    expect(arg.scopes).toEqual([]);
  });

  it("传空数组 → 写入 []", async () => {
    const spy = vi
      .spyOn(ApiTokenRepository, "create")
      .mockResolvedValueOnce({} as any);

    await ApiTokenService.createToken(1, { name: "empty-scopes", scopes: [] });

    const arg = spy.mock.calls[0][0];
    expect(arg.scopes).toEqual([]);
  });

  it("超级管理员传 '*' → 保留为通配符", async () => {
    const spy = vi
      .spyOn(ApiTokenRepository, "create")
      .mockResolvedValueOnce({} as any);

    mockSuperAdminUser();
    await ApiTokenService.createToken(1, {
      name: "wildcard",
      scopes: ["*"],
    });

    const arg = spy.mock.calls[0][0];
    expect(arg.scopes).toEqual(["*"]);
  });

  it("普通用户传 '*' → 抛 BusinessError", async () => {
    mockNormalUser(["system:user:list"]);
    await expect(
      ApiTokenService.createToken(1, {
        name: "wildcard",
        scopes: ["*"],
      }),
    ).rejects.toMatchObject({
      code: ValidationErrorCode.INVALID_PARAMETER,
    });
  });

  it("超级管理员传 '__super_admin__' → 保留为旁路标记", async () => {
    const spy = vi
      .spyOn(ApiTokenRepository, "create")
      .mockResolvedValueOnce({} as any);

    mockSuperAdminUser();
    await ApiTokenService.createToken(1, {
      name: "super-bypass",
      scopes: ["__super_admin__"],
    });

    const arg = spy.mock.calls[0][0];
    expect(arg.scopes).toEqual(["__super_admin__"]);
  });

  it("普通用户有权限时传 '__super_admin__' → 保留", async () => {
    const spy = vi
      .spyOn(ApiTokenRepository, "create")
      .mockResolvedValueOnce({} as any);

    mockNormalUser(["system:user:list", "__super_admin__"]);
    await ApiTokenService.createToken(1, {
      name: "super-bypass",
      scopes: ["__super_admin__"],
    });

    const arg = spy.mock.calls[0][0];
    expect(arg.scopes).toEqual(["__super_admin__"]);
  });

  it("普通用户无权限时传 '__super_admin__' → 抛 BusinessError", async () => {
    mockNormalUser(["system:user:list"]);
    await expect(
      ApiTokenService.createToken(1, {
        name: "super-bypass",
        scopes: ["__super_admin__"],
      }),
    ).rejects.toMatchObject({
      code: ValidationErrorCode.INVALID_PARAMETER,
    });
  });

  it("传已知且拥有的 permission code → 保留", async () => {
    const spy = vi
      .spyOn(ApiTokenRepository, "create")
      .mockResolvedValueOnce({} as any);

    mockNormalUser(["system:user:list", "system:user:create"]);
    await ApiTokenService.createToken(1, {
      name: "user-list-only",
      scopes: ["system:user:list"],
    });

    const arg = spy.mock.calls[0][0];
    expect(arg.scopes).toEqual(["system:user:list"]);
  });

  it("传不拥有的 permission code → 抛 BusinessError", async () => {
    mockNormalUser(["system:user:list"]);
    await expect(
      ApiTokenService.createToken(1, {
        name: "no-perm",
        scopes: ["system:role:list"],
      }),
    ).rejects.toMatchObject({
      code: ValidationErrorCode.INVALID_PARAMETER,
    });
  });

  it("传未知 code → 抛 BusinessError INVALID_PARAMETER", async () => {
    await expect(
      ApiTokenService.createToken(1, {
        name: "bad-scope",
        scopes: ["system:nonexistent:code"],
      }),
    ).rejects.toMatchObject({
      code: ValidationErrorCode.INVALID_PARAMETER,
    });
  });

  it("混合：已知 + 未知 → 抛错（不写入数据库）", async () => {
    const spy = vi.spyOn(ApiTokenRepository, "create");
    mockNormalUser(["system:user:list"]);
    await expect(
      ApiTokenService.createToken(1, {
        name: "mixed",
        scopes: ["system:user:list", "totally:invalid:code"],
      }),
    ).rejects.toBeTruthy();
    expect(spy).not.toHaveBeenCalled();
  });

  it("同时含 '*' 和具体 code（超级管理员）→ 都保留", async () => {
    const spy = vi
      .spyOn(ApiTokenRepository, "create")
      .mockResolvedValueOnce({} as any);

    mockSuperAdminUser();
    await ApiTokenService.createToken(1, {
      name: "mixed-allowed",
      scopes: ["*", "system:user:list", "__super_admin__"],
    });

    const arg = spy.mock.calls[0][0];
    expect(arg.scopes).toEqual(["*", "system:user:list", "__super_admin__"]);
  });

  it("空 scopes → 允许创建（保守默认）", async () => {
    const spy = vi
      .spyOn(ApiTokenRepository, "create")
      .mockResolvedValueOnce({} as any);

    mockUserWithNoPerms();
    await ApiTokenService.createToken(1, {
      name: "empty",
      scopes: [],
    });

    const arg = spy.mock.calls[0][0];
    expect(arg.scopes).toEqual([]);
  });

  it("普通用户申请未启用插件权限 → 抛 BusinessError", async () => {
    // shop:product:list 不在真实 catalog 中（plugin 未启用），normalizeApiTokenScopes
    // 在到达 grantable 检查前就先抛"未知权限码"。
    mockUserWithDisabledPluginPerm();
    await expect(
      ApiTokenService.createToken(1, {
        name: "disabled-plugin",
        scopes: ["shop:product:list"],
      }),
    ).rejects.toMatchObject({
      code: ValidationErrorCode.INVALID_PARAMETER,
      message: expect.stringContaining("未知权限码"),
    });
  });

  it("普通用户申请 `*` → 抛 BusinessError", async () => {
    mockNormalUser(["system:user:list"]);
    await expect(
      ApiTokenService.createToken(1, {
        name: "wildcard-forbidden",
        scopes: ["*"],
      }),
    ).rejects.toMatchObject({
      code: ValidationErrorCode.INVALID_PARAMETER,
      message: expect.stringContaining("仅限超级管理员"),
    });
  });

  it("非超级管理员伪造 `__super_admin__` → 抛 BusinessError", async () => {
    // 普通用户 roleCodes 不含 super_admin，无法使用通配符
    mockNormalUser(["system:user:list"]);
    await expect(
      ApiTokenService.createToken(1, {
        name: "fake-bypass",
        scopes: ["__super_admin__"],
      }),
    ).rejects.toMatchObject({
      code: ValidationErrorCode.INVALID_PARAMETER,
    });
  });

  it("超级管理员申请 `*` → 创建成功", async () => {
    const spy = vi
      .spyOn(ApiTokenRepository, "create")
      .mockResolvedValueOnce({} as any);

    mockSuperAdminUser();
    await ApiTokenService.createToken(1, {
      name: "admin-wildcard",
      scopes: ["*"],
    });

    const arg = spy.mock.calls[0][0];
    expect(arg.scopes).toEqual(["*"]);
  });

  it("超级管理员申请 `__super_admin__` → 创建成功", async () => {
    const spy = vi
      .spyOn(ApiTokenRepository, "create")
      .mockResolvedValueOnce({} as any);

    mockSuperAdminUser();
    await ApiTokenService.createToken(1, {
      name: "admin-bypass",
      scopes: ["__super_admin__"],
    });

    const arg = spy.mock.calls[0][0];
    expect(arg.scopes).toEqual(["__super_admin__"]);
  });

  it("权限加载失败 → 创建失败，fail closed", async () => {
    // PermissionService.loadRoleIdsForUser 抛出，service 必须 fail closed（不创建 token）。
    vi.spyOn(PermissionService, "loadRoleIdsForUser").mockRejectedValueOnce(
      new Error("permission backend unavailable"),
    );
    const spy = vi.spyOn(ApiTokenRepository, "create");

    await expect(
      ApiTokenService.createToken(1, {
        name: "perm-load-fail",
        scopes: ["system:user:list"],
      }),
    ).rejects.toThrow();
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("ApiTokenService.createToken — duration / expiresAt 互斥", () => {
  it("duration + expiresAt 同时传 → 抛 INVALID_PARAMETER", async () => {
    await expect(
      ApiTokenService.createToken(1, {
        name: "bad",
        duration: "30d",
        expiresAt: "2027-01-01T00:00:00Z",
      }),
    ).rejects.toMatchObject({
      code: ValidationErrorCode.INVALID_PARAMETER,
    });
  });

  it("expiresAt 格式非法 → 抛 PARAMETER_FORMAT_ERROR", async () => {
    await expect(
      ApiTokenService.createToken(1, {
        name: "bad-date",
        expiresAt: "not-a-date",
      }),
    ).rejects.toMatchObject({
      code: ValidationErrorCode.PARAMETER_FORMAT_ERROR,
    });
  });

  it("duration='never' → expiresAt=null", async () => {
    const spy = vi
      .spyOn(ApiTokenRepository, "create")
      .mockResolvedValueOnce({} as any);

    await ApiTokenService.createToken(1, {
      name: "never",
      duration: "never",
    });

    const arg = spy.mock.calls[0][0];
    expect(arg.expiresAt).toBeNull();
  });

  it("默认（无 duration / expiresAt）→ 30d", async () => {
    const spy = vi
      .spyOn(ApiTokenRepository, "create")
      .mockResolvedValueOnce({} as any);

    await ApiTokenService.createToken(1, { name: "default" });

    const arg = spy.mock.calls[0][0];
    expect(arg.expiresAt).toBeInstanceOf(Date);
    const daysAhead =
      (arg.expiresAt!.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(daysAhead).toBeGreaterThan(29.9);
    expect(daysAhead).toBeLessThan(30.1);
  });

  it("duration='7d' → ~7d", async () => {
    const spy = vi
      .spyOn(ApiTokenRepository, "create")
      .mockResolvedValueOnce({} as any);

    await ApiTokenService.createToken(1, {
      name: "week",
      duration: "7d",
    });

    const arg = spy.mock.calls[0][0];
    const daysAhead =
      (arg.expiresAt!.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(daysAhead).toBeGreaterThan(6.9);
    expect(daysAhead).toBeLessThan(7.1);
  });
});

// ============================================================================
// 展示适配器测试（2026-07-14）：getAvailableScopesForUser 复用授权数据
// 严格只消费 grantableCodes / isSuperAdmin / catalog，禁止重建授权判断。
// ============================================================================

describe("getAvailableScopesForUser — 展示适配器", () => {
  it("grantableCodes 不含的 catalog 条目不进入展示", async () => {
    vi.spyOn(PermissionService, "loadRoleIdsForUser").mockResolvedValueOnce([1]);
    vi.spyOn(PermissionService, "loadForRoleIds").mockResolvedValueOnce({
      perms: new Set(["system:user:list"]),
      roleCodes: new Set(["normal_user"]),
    });

    const groups = await getAvailableScopesForUser(1);

    const allCodes = groups.flatMap(g => g.options.map(o => o.value));
    expect(allCodes).toEqual(["system:user:list"]);
    expect(groups).toHaveLength(1);
    expect(groups[0].system).toBe("system");
  });

  it("grantableCodes 含 sentinel：返回 special 中的 __super_admin__ 展示项", async () => {
    vi.spyOn(PermissionService, "loadRoleIdsForUser").mockResolvedValueOnce([2]);
    vi.spyOn(PermissionService, "loadForRoleIds").mockResolvedValueOnce({
      perms: new Set(["system:user:list", SUPER_ADMIN_BYPASS]),
      roleCodes: new Set(["normal_user"]),
    });

    const groups = await getAvailableScopesForUser(2);

    const special = groups.find(g => g.system === "special");
    expect(special).toBeDefined();
    const specialCodes = special!.options.map(o => o.value);
    expect(specialCodes).toContain(SUPER_ADMIN_BYPASS);
    expect(specialCodes).not.toContain("*"); // 非 super_admin，不展示通配符
  });

  it("isSuperAdmin: true 时返回 special 中的通配符 *", async () => {
    vi.spyOn(PermissionService, "loadRoleIdsForUser").mockResolvedValueOnce([3]);
    vi.spyOn(PermissionService, "loadForRoleIds").mockResolvedValueOnce({
      perms: new Set(["system:user:list", SUPER_ADMIN_BYPASS]),
      roleCodes: new Set(["super_admin"]),
    });

    const groups = await getAvailableScopesForUser(3);

    const special = groups.find(g => g.system === "special");
    expect(special).toBeDefined();
    const specialCodes = special!.options.map(o => o.value);
    expect(specialCodes).toContain("*");
    expect(specialCodes).toContain(SUPER_ADMIN_BYPASS);
  });

  it("插件 group 应用同样的 grantableCodes 过滤：未授予的不返回", async () => {
    // 当前真实 catalog 内的 plugin group（如 hello）由测试 setup 之前 force-import
    // 的 routes 注册；本断言仅检查 catalog 内注册项被严格按 grantableCodes 过滤，
    // 不依赖具体 plugin group 存在。
    vi.spyOn(PermissionService, "loadRoleIdsForUser").mockResolvedValueOnce([4]);
    vi.spyOn(PermissionService, "loadForRoleIds").mockResolvedValueOnce({
      perms: new Set(["system:user:list"]),
      roleCodes: new Set(["normal_user"]),
    });

    const groups = await getAvailableScopesForUser(4);

    // 没有 plugin group 被授予 → 只有 system 一组
    const pluginGroups = groups.filter(
      g => !["system", "shop", "portal", "special"].includes(g.system),
    );
    expect(pluginGroups).toEqual([]);
  });

  it("无任何授权时仅返回空数组（不返回空 group）", async () => {
    vi.spyOn(PermissionService, "loadRoleIdsForUser").mockResolvedValueOnce([5]);
    vi.spyOn(PermissionService, "loadForRoleIds").mockResolvedValueOnce({
      perms: new Set<string>(),
      roleCodes: new Set<string>(),
    });

    const groups = await getAvailableScopesForUser(5);
    expect(groups).toEqual([]);
  });

  it("固定 group 顺序：system → shop → portal → special", async () => {
    // 用真实 catalog（system 路径由 setup.ts 注册），断言四个 fixed group 的相对顺序。
    vi.spyOn(PermissionService, "loadRoleIdsForUser").mockResolvedValueOnce([6]);
    vi.spyOn(PermissionService, "loadForRoleIds").mockResolvedValueOnce({
      perms: new Set(["system:user:list", SUPER_ADMIN_BYPASS]),
      roleCodes: new Set(["super_admin"]),
    });

    const groups = await getAvailableScopesForUser(6);
    const systemOrder = groups.map(g => g.system);
    // 验证 fixed group 在返回结果中的相对顺序（它们是否都在场取决于 catalog 注册情况，
    // 但相对顺序 system → shop → portal → special 必须保持）。
    const fixedOrder = ["system", "shop", "portal", "special"];
    const presentFixed = systemOrder.filter(s => fixedOrder.includes(s));
    const expectedOrder = fixedOrder.filter(s => presentFixed.includes(s));
    expect(presentFixed).toEqual(expectedOrder);
  });
});
