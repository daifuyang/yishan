import Fastify from "fastify";
import apiTokensPlugin from "../src/core/routes/api/v1/me/api-tokens/index.ts";
import registerCommonSchemas from "../src/core/schemas/common.ts";
import { registerApiToken } from "../src/core/schemas/api-token.ts";
import errorHandlerPlugin from "../src/core/plugins/external/error-handler.ts";
import { ApiTokenRepository } from "../src/core/repositories/api-token.repository.ts";
import { PermissionService } from "../src/core/services/permission.service.ts";
import { AuthErrorCode } from "../src/constants/business-codes/auth.ts";
import { ValidationErrorCode } from "../src/constants/business-codes/validation.ts";
import { describe, it, expect, vi, beforeEach } from "vitest";

const currentUser = {
  id: 1,
  username: "admin",
  email: "admin@example.com",
  phone: "13800138000",
  realName: "Admin",
  gender: "1",
  genderName: "男",
  status: "1",
  statusName: "启用",
  loginCount: 10,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  lastLoginTime: new Date().toISOString(),
};

async function buildApp() {
  const app = Fastify({ logger: false });
  app.decorate("authenticate", async (request: any) => {
    const auth = request.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      const error = new Error("Unauthorized") as any;
      error.statusCode = 401;
      throw error;
    }
    request.currentUser = currentUser;
  });
  // Section 7：单测不实际跑限流。
  app.decorate("rateLimit", () => async (_request: any, _reply: any) => undefined);
  // 单测不需要真实 RBAC 校验：no-op 占位。
  app.decorate("requirePermission", () => async (_request: any, _reply: any) => undefined);
  app.decorate("requireRole", () => async (_request: any, _reply: any) => undefined);

  await app.register(errorHandlerPlugin);
  registerCommonSchemas(app);
  registerApiToken(app);
  await app.register(apiTokensPlugin, { prefix: "/api/v1/me/api-tokens" });
  await app.ready();
  return app;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("Me API token routes", () => {
  it("POST /api/v1/me/api-tokens without auth returns 401", async () => {
    const app = await buildApp();

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/me/api-tokens",
      payload: { name: "ci-token" },
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.success).toBe(false);

    await app.close();
  });

  it("POST /api/v1/me/api-tokens creates a token and returns plaintext once", async () => {
    const app = await buildApp();
    const now = new Date("2026-07-11T00:00:00.000Z");
    vi.spyOn(ApiTokenRepository, "create").mockResolvedValueOnce({
      id: 11,
      name: "ci-token",
      userId: 1,
      expiresAt: null,
      lastUsedAt: null,
      lastUsedIp: null,
      createdAt: now,
      updatedAt: now,
      raw: "yishan_pat_testtoken",
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/me/api-tokens",
      headers: { Authorization: "Bearer access-token" },
      payload: { name: "ci-token" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({ id: 11, name: "ci-token", userId: 1 });
    expect(body.data.token).toMatch(/^yishan_pat_/);
    const callArg = vi.mocked(ApiTokenRepository.create).mock.calls[0][0];
    expect(callArg.userId).toBe(1);
    expect(callArg.name).toBe("ci-token");
    // Default duration: 30d => ~30 days from now
    expect(callArg.expiresAt).toBeInstanceOf(Date);
    const daysAhead =
      (callArg.expiresAt!.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(daysAhead).toBeGreaterThan(29.9);
    expect(daysAhead).toBeLessThan(30.1);

    await app.close();
  });

  it("POST /api/v1/me/api-tokens with duration='never' sets expiresAt=null", async () => {
    const app = await buildApp();
    const now = new Date("2026-07-11T00:00:00.000Z");
    vi.spyOn(ApiTokenRepository, "create").mockResolvedValueOnce({
      id: 12,
      name: "never-token",
      userId: 1,
      expiresAt: null,
      lastUsedAt: null,
      lastUsedIp: null,
      createdAt: now,
      updatedAt: now,
      raw: "yishan_pat_never",
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/me/api-tokens",
      headers: { Authorization: "Bearer access-token" },
      payload: { name: "never-token", duration: "never" },
    });

    expect(res.statusCode).toBe(200);
    const callArg = vi.mocked(ApiTokenRepository.create).mock.calls[0][0];
    expect(callArg.expiresAt).toBeNull();

    await app.close();
  });

  it("POST /api/v1/me/api-tokens rejects duration + expiresAt together", async () => {
    const app = await buildApp();

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/me/api-tokens",
      headers: { Authorization: "Bearer access-token" },
      payload: {
        name: "bad",
        duration: "30d",
        expiresAt: "2027-01-01T00:00:00Z",
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.code).toBe(ValidationErrorCode.INVALID_PARAMETER);

    await app.close();
  });

  it("GET /api/v1/me/api-tokens lists current user's tokens without plaintext token", async () => {
    const app = await buildApp();
    const now = new Date("2026-07-11T00:00:00.000Z");
    vi.spyOn(ApiTokenRepository, "listByUser").mockResolvedValueOnce([
      {
        id: 11,
        name: "ci-token",
        userId: 1,
        expiresAt: null,
        lastUsedAt: null,
        lastUsedIp: null,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/me/api-tokens",
      headers: { Authorization: "Bearer access-token" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.total).toBe(1);
    expect(body.data.list[0]).toMatchObject({ id: 11, name: "ci-token", userId: 1 });
    expect(body.data.list[0]).not.toHaveProperty("token");

    await app.close();
  });

  it("GET /api/v1/me/api-tokens/:id returns one token", async () => {
    const app = await buildApp();
    const now = new Date("2026-07-11T00:00:00.000Z");
    vi.spyOn(ApiTokenRepository, "findByIdForUser").mockResolvedValueOnce({
      id: 11,
      name: "ci-token",
      userId: 1,
      expiresAt: null,
      lastUsedAt: null,
      lastUsedIp: null,
      createdAt: now,
      updatedAt: now,
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/me/api-tokens/11",
      headers: { Authorization: "Bearer access-token" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({ id: 11, name: "ci-token", userId: 1 });

    await app.close();
  });

  it("DELETE /api/v1/me/api-tokens/:id revokes one token", async () => {
    const app = await buildApp();
    vi.spyOn(ApiTokenRepository, "revoke").mockResolvedValueOnce(true);

    const res = await app.inject({
      method: "DELETE",
      url: "/api/v1/me/api-tokens/11",
      headers: { Authorization: "Bearer access-token" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ id: 11 });
    expect(ApiTokenRepository.revoke).toHaveBeenCalledWith(11, 1);

    await app.close();
  });

  it("DELETE /api/v1/me/api-tokens/:id again returns 401", async () => {
    const app = await buildApp();
    vi.spyOn(ApiTokenRepository, "revoke").mockResolvedValueOnce(false);

    const res = await app.inject({
      method: "DELETE",
      url: "/api/v1/me/api-tokens/11",
      headers: { Authorization: "Bearer access-token" },
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.code).toBe(AuthErrorCode.API_TOKEN_NOT_FOUND);

    await app.close();
  });

  describe("GET /api/v1/me/api-tokens/available-scopes", () => {
    it("returns 401 without auth", async () => {
      const app = await buildApp();

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/me/api-tokens/available-scopes",
      });

      expect(res.statusCode).toBe(401);
      await app.close();
    });

    it("returns grouped scopes for normal user", async () => {
      const app = await buildApp();
      vi.spyOn(PermissionService, "loadRoleIdsForUser").mockResolvedValueOnce([2]);
      vi.spyOn(PermissionService, "loadForRoleIds").mockResolvedValueOnce({
        perms: new Set(["system:user:list", "system:user:create"]),
        roleCodes: new Set(["normal_user"]),
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/me/api-tokens/available-scopes",
        headers: { Authorization: "Bearer access-token" },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.groups).toBeInstanceOf(Array);
      // Should have "系统管理" group
      const systemGroup = body.data.groups.find((g: any) => g.system === "system");
      expect(systemGroup).toBeDefined();
      expect(systemGroup.options.some((o: any) => o.value === "system:user:list")).toBe(true);
      // Normal user should NOT see wildcard or super_admin bypass
      const specialGroup = body.data.groups.find((g: any) => g.system === "special");
      expect(specialGroup).toBeUndefined();

      await app.close();
    });

    it("super_admin sees wildcard option", async () => {
      const app = await buildApp();
      vi.spyOn(PermissionService, "loadRoleIdsForUser").mockResolvedValueOnce([1]);
      vi.spyOn(PermissionService, "loadForRoleIds").mockResolvedValueOnce({
        perms: new Set(["system:user:list", "__super_admin__"]),
        roleCodes: new Set(["super_admin"]),
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/me/api-tokens/available-scopes",
        headers: { Authorization: "Bearer access-token" },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      // Super admin should see special group with wildcard
      const specialGroup = body.data.groups.find((g: any) => g.system === "special");
      expect(specialGroup).toBeDefined();
      expect(specialGroup.options.some((o: any) => o.value === "*")).toBe(true);
      expect(specialGroup.options.some((o: any) => o.value === "__super_admin__")).toBe(true);

      await app.close();
    });

    it("only returns known permission codes", async () => {
      const app = await buildApp();
      vi.spyOn(PermissionService, "loadRoleIdsForUser").mockResolvedValueOnce([2]);
      // Simulate role has some unknown/manifest-only codes
      vi.spyOn(PermissionService, "loadForRoleIds").mockResolvedValueOnce({
        perms: new Set(["system:user:list", "plugin:custom:action", "unknown:code"]),
        roleCodes: new Set(["normal_user"]),
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/me/api-tokens/available-scopes",
        headers: { Authorization: "Bearer access-token" },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      // Should only contain known codes
      const allValues = body.data.groups.flatMap((g: any) => g.options.map((o: any) => o.value));
      expect(allValues).toContain("system:user:list");
      expect(allValues).not.toContain("plugin:custom:action");
      expect(allValues).not.toContain("unknown:code");

      await app.close();
    });
  });
});
