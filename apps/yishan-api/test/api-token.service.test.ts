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
 *   - SUPER_ADMIN_BYPASS 不在活动权限目录中，测试需正确模拟
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiTokenService, getAvailableScopesForUser } from "../src/core/services/api-token.service.js";
import { ApiTokenRepository } from "../src/core/repositories/api-token.repository.js";
import { PermissionService } from "../src/core/services/permission.service.js";
import { ValidationErrorCode } from "../src/constants/business-codes/validation.js";
import { SUPER_ADMIN_BYPASS } from "../src/constants/permission-codes.js";
import { getGlobalCatalog } from "../src/core/services/permission-catalog.service.js";

// ============================================================================
// Mock helpers
// ============================================================================

// 注意：getGlobalCatalog().getActiveCodes() 返回的 Set 不包含 SUPER_ADMIN_BYPASS
// （sentinel 是内部标识，不在活动权限目录中）

// Helper to mock super admin user (rolePerms 含 SUPER_ADMIN_BYPASS，roleCodes 含 super_admin)
function mockSuperAdminUser() {
  vi.spyOn(PermissionService, "loadRoleIdsForUser").mockResolvedValueOnce([1]);
  vi.spyOn(PermissionService, "loadForRoleIds").mockResolvedValueOnce({
    perms: new Set(["system:user:list", "system:role:list", SUPER_ADMIN_BYPASS]),
    roleCodes: new Set(["super_admin"]),
  });
  // 活动权限目录：只包含业务权限，不包含 SUPER_ADMIN_BYPASS
  vi.spyOn(getGlobalCatalog(), "getActiveCodes").mockResolvedValue(
    new Set(["system:user:list", "system:role:list"]),
  );
}

// Helper to mock normal user with specific permissions
function mockNormalUser(perms: string[]) {
  vi.spyOn(PermissionService, "loadRoleIdsForUser").mockResolvedValueOnce([2]);
  // 从 perms 中过滤掉 SUPER_ADMIN_BYPASS，因为它是 sentinel 不是业务权限
  const businessPerms = perms.filter(p => p !== SUPER_ADMIN_BYPASS);
  vi.spyOn(PermissionService, "loadForRoleIds").mockResolvedValueOnce({
    perms: new Set(perms),
    roleCodes: new Set(["normal_user"]),
  });
  // 活动权限目录：只包含业务权限（不包含 SUPER_ADMIN_BYPASS）
  vi.spyOn(getGlobalCatalog(), "getActiveCodes").mockResolvedValue(
    new Set(businessPerms),
  );
}

// Helper to mock user with no permissions
function mockUserWithNoPerms() {
  vi.spyOn(PermissionService, "loadRoleIdsForUser").mockResolvedValueOnce([3]);
  vi.spyOn(PermissionService, "loadForRoleIds").mockResolvedValueOnce({
    perms: new Set([]),
    roleCodes: new Set([]),
  });
  vi.spyOn(getGlobalCatalog(), "getActiveCodes").mockResolvedValue(new Set([]));
}

// Helper to mock disabled plugin permission scenario
function mockUserWithDisabledPluginPerm() {
  vi.spyOn(PermissionService, "loadRoleIdsForUser").mockResolvedValueOnce([4]);
  vi.spyOn(PermissionService, "loadForRoleIds").mockResolvedValueOnce({
    perms: new Set(["system:user:list", "shop:product:list"]),
    roleCodes: new Set(["normal_user"]),
  });
  // 活动权限目录只包含 system:user:list，shop:product:list 来自已禁用插件
  vi.spyOn(getGlobalCatalog(), "getActiveCodes").mockResolvedValue(
    new Set(["system:user:list"]),
  );
  vi.spyOn(getGlobalCatalog(), "getDeclaredCodes").mockResolvedValue(
    new Set(["system:user:list", "shop:product:list"]),
  );
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
    // 已声明但未启用的插件权限不是未知码；用户不能把它授予 PAT。
    mockUserWithDisabledPluginPerm();
    await expect(
      ApiTokenService.createToken(1, {
        name: "disabled-plugin",
        scopes: ["shop:product:list"],
      }),
    ).rejects.toMatchObject({
      code: ValidationErrorCode.INVALID_PARAMETER,
      message: expect.stringContaining("不在您的授权范围内"),
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

  it("Catalog 状态读取失败 → 创建失败，fail closed", async () => {
    // 模拟 Catalog 初始化失败
    vi.spyOn(PermissionService, "loadRoleIdsForUser").mockResolvedValueOnce([1]);
    vi.spyOn(PermissionService, "loadForRoleIds").mockResolvedValueOnce({
      perms: new Set(["system:user:list"]),
      roleCodes: new Set(["normal_user"]),
    });
    // getGlobalCatalog 抛出 CatalogNotInitializedError
    vi.spyOn(getGlobalCatalog(), "getActiveCodes").mockRejectedValue(
      new Error("Catalog not initialized"),
    );

    await expect(
      ApiTokenService.createToken(1, {
        name: "catalog-fail",
        scopes: ["system:user:list"],
      }),
    ).rejects.toThrow();
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
  /** 构造一个 ActivePermissionItem 列表 */
  function item(code: string, group: string, label: string, source: "core" | string = "core") {
    return { code, group, label, description: `${code}-desc`, source };
  }

  /** 默认 catalog：含 system/shop/portal 各一项 + 一个 hello 插件项 */
  function buildCatalog() {
    return [
      item("system:user:list", "system", "用户列表"),
      item("shop:product:list", "shop", "商品列表"),
      item("portal:article:list", "portal", "文章列表"),
      item("hello:read", "hello", "Hello 读取", "yishan/hello"),
    ];
  }

  it("grantableCodes 不含的 catalog 条目不进入展示", async () => {
    vi.spyOn(PermissionService, "loadRoleIdsForUser").mockResolvedValueOnce([1]);
    vi.spyOn(PermissionService, "loadForRoleIds").mockResolvedValueOnce({
      perms: new Set(["system:user:list"]),
      roleCodes: new Set(["normal_user"]),
    });
    vi.spyOn(getGlobalCatalog(), "getActiveCodes").mockResolvedValue(
      new Set(["system:user:list", "shop:product:list", "portal:article:list", "hello:read"]),
    );
    vi.spyOn(getGlobalCatalog(), "getActiveCatalog").mockResolvedValue(buildCatalog());

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
    vi.spyOn(getGlobalCatalog(), "getActiveCodes").mockResolvedValue(
      new Set(["system:user:list", "shop:product:list", "portal:article:list", "hello:read"]),
    );
    vi.spyOn(getGlobalCatalog(), "getActiveCatalog").mockResolvedValue(buildCatalog());

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
    vi.spyOn(getGlobalCatalog(), "getActiveCodes").mockResolvedValue(
      new Set(["system:user:list", "shop:product:list", "portal:article:list", "hello:read"]),
    );
    vi.spyOn(getGlobalCatalog(), "getActiveCatalog").mockResolvedValue(buildCatalog());

    const groups = await getAvailableScopesForUser(3);

    const special = groups.find(g => g.system === "special");
    expect(special).toBeDefined();
    const specialCodes = special!.options.map(o => o.value);
    expect(specialCodes).toContain("*");
    expect(specialCodes).toContain(SUPER_ADMIN_BYPASS);
  });

  it("插件 group 应用同样的 grantableCodes 过滤：未授予的不返回", async () => {
    vi.spyOn(PermissionService, "loadRoleIdsForUser").mockResolvedValueOnce([4]);
    // 角色只持有 hello:read，不持有 system/shop/portal 任何业务权限
    vi.spyOn(PermissionService, "loadForRoleIds").mockResolvedValueOnce({
      perms: new Set(["hello:read"]),
      roleCodes: new Set(["normal_user"]),
    });
    vi.spyOn(getGlobalCatalog(), "getActiveCodes").mockResolvedValue(
      new Set(["system:user:list", "shop:product:list", "portal:article:list", "hello:read"]),
    );
    vi.spyOn(getGlobalCatalog(), "getActiveCatalog").mockResolvedValue(buildCatalog());

    const groups = await getAvailableScopesForUser(4);

    // 应只剩一个 hello group
    expect(groups).toHaveLength(1);
    expect(groups[0].system).toBe("hello");
    expect(groups[0].options.map(o => o.value)).toEqual(["hello:read"]);
  });

  it("无任何授权时仅返回空数组（不返回空 group）", async () => {
    vi.spyOn(PermissionService, "loadRoleIdsForUser").mockResolvedValueOnce([5]);
    vi.spyOn(PermissionService, "loadForRoleIds").mockResolvedValueOnce({
      perms: new Set<string>(),
      roleCodes: new Set<string>(),
    });
    vi.spyOn(getGlobalCatalog(), "getActiveCodes").mockResolvedValue(
      new Set(["system:user:list", "hello:read"]),
    );
    vi.spyOn(getGlobalCatalog(), "getActiveCatalog").mockResolvedValue(buildCatalog());

    const groups = await getAvailableScopesForUser(5);
    expect(groups).toEqual([]);
  });

  it("固定 group 顺序：system → shop → portal → special，插件 group 追加在 special 后", async () => {
    vi.spyOn(PermissionService, "loadRoleIdsForUser").mockResolvedValueOnce([6]);
    vi.spyOn(PermissionService, "loadForRoleIds").mockResolvedValueOnce({
      perms: new Set([
        "system:user:list",
        "shop:product:list",
        "portal:article:list",
        "hello:read",
        SUPER_ADMIN_BYPASS,
      ]),
      roleCodes: new Set(["super_admin"]),
    });
    vi.spyOn(getGlobalCatalog(), "getActiveCodes").mockResolvedValue(
      new Set(["system:user:list", "shop:product:list", "portal:article:list", "hello:read"]),
    );
    vi.spyOn(getGlobalCatalog(), "getActiveCatalog").mockResolvedValue(buildCatalog());

    const groups = await getAvailableScopesForUser(6);
    expect(groups.map(g => g.system)).toEqual([
      "system",
      "shop",
      "portal",
      "special",
      "hello",
    ]);
  });
});
