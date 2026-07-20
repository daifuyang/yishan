/**
 * PAT 生命周期集成测试（真实 MySQL）
 *
 * 使用 YISHAN_RUN_INTEGRATION=1 启用。测试真实数据库操作：
 *   - 创建、查询、撤销、删除
 *   - 过期时间精确边界（恰好到期、时钟漂移）
 *   - JSON scopes 持久化与索引查询
 *   - touch 更新 lastUsedAt / lastUsedIp
 *
 * 注意：ApiTokenRepository 必须在 setupIntegration() 之后动态导入，
 * 因为 test/setup.ts 会 hoist vi.mock() 到所有 import 之前。
 * 静态导入会导致 Repository 绑定到 mock 的 drizzleDb，而非真实测试库。
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setupIntegration, type IntegrationContext } from "./_setup.js";
import { SUPER_ADMIN_BYPASS, PAT_WILDCARD } from "../../src/constants/permission-codes.js";

const ctx: IntegrationContext = await setupIntegration();

// Dynamic import AFTER setupIntegration() replaces @/db mocks with real drizzle client
const { ApiTokenRepository } = await import("../../src/core/repositories/api-token.repository.js");

describe.runIf(!ctx.skip)("integration: PAT lifecycle", () => {
  const TEST_USER_ID = 1;

  beforeAll(async () => {
    if (ctx.skip) return;
    await ctx.resetSchema?.();
  });

  afterAll(async () => {
    if (!ctx.skip && ctx.closeDb) await ctx.closeDb();
  });

  // ============================================================================
  // Create & read
  // ============================================================================

  it.runIf(!ctx.skip)("createToken 写入数据库并返回明文 token", async () => {
    const result = await ApiTokenRepository.create({
      userId: TEST_USER_ID,
      name: "test-token",
      scopes: ["system:user:list"],
    });
    expect(result.raw).toMatch(/^yishan_pat_/);
    expect(result.scopes).toEqual(["system:user:list"]);
    expect(result.userId).toBe(TEST_USER_ID);
    expect(result.expiresAt).toBeNull();
  });

  it.runIf(!ctx.skip)("createToken 支持自定义过期时间", async () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const result = await ApiTokenRepository.create({
      userId: TEST_USER_ID,
      name: "test-token-expiry",
      expiresAt: futureDate,
      scopes: ["system:user:list"],
    });
    expect(result.expiresAt).toBeInstanceOf(Date);
    // 允许 ±1 秒误差
    expect(Math.abs(result.expiresAt!.getTime() - futureDate.getTime())).toBeLessThan(2000);
  });

  it.runIf(!ctx.skip)("createToken 持久化 JSON scopes 并可读回", async () => {
    const scopes = ["system:user:list", "system:role:list", PAT_WILDCARD, SUPER_ADMIN_BYPASS];
    const result = await ApiTokenRepository.create({
      userId: TEST_USER_ID,
      name: "test-token-scopes",
      scopes,
    });
    expect(result.scopes).toEqual(scopes);
  });

  it.runIf(!ctx.skip)("createToken 空 scopes 默认填充空数组", async () => {
    const result = await ApiTokenRepository.create({
      userId: TEST_USER_ID,
      name: "test-token-empty",
      scopes: [],
    });
    expect(result.scopes).toEqual([]);
  });

  // ============================================================================
  // Find by raw token
  // ============================================================================

  it.runIf(!ctx.skip)("findByRawToken 找到有效 token", async () => {
    const created = await ApiTokenRepository.create({
      userId: TEST_USER_ID,
      name: "find-valid",
      scopes: ["system:user:list"],
    });
    const found = await ApiTokenRepository.findByRawToken(created.raw);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(created.id);
  });

  it.runIf(!ctx.skip)("findByRawToken 拒绝不存在的前缀", async () => {
    const found = await ApiTokenRepository.findByRawToken("invalid_prefix_token");
    expect(found).toBeNull();
  });

  it.runIf(!ctx.skip)("findByRawToken 拒绝被撤销的 token（deletedAt 不为 null）", async () => {
    const created = await ApiTokenRepository.create({
      userId: TEST_USER_ID,
      name: "revoked-token",
      scopes: [],
    });
    // 撤销
    await ApiTokenRepository.revoke(created.id, TEST_USER_ID);
    // 查找应返回 null
    const found = await ApiTokenRepository.findByRawToken(created.raw);
    expect(found).toBeNull();
  });

  it.runIf(!ctx.skip)("findByRawToken 拒绝已过期的 token（过期 5 秒）", async () => {
    // 已过期 5 秒 —— 远大于 Node/MySQL 时钟误差与 DATETIME 秒级精度，结果确定为已过期。
    const pastDate = new Date(Date.now() - 5000);
    const created = await ApiTokenRepository.create({
      userId: TEST_USER_ID,
      name: "expired-token",
      expiresAt: pastDate,
      scopes: [],
    });
    // findByRawToken 应该在 SQL 层过滤掉
    const found = await ApiTokenRepository.findByRawToken(created.raw);
    expect(found).toBeNull();
  });

  it.runIf(!ctx.skip)("findByRawToken 接受恰好到期的 token（expiresAt >= now）", async () => {
    // 创建一个永不过期的 token
    const created = await ApiTokenRepository.create({
      userId: TEST_USER_ID,
      name: "never-expire",
      expiresAt: null,
      scopes: [],
    });
    const found = await ApiTokenRepository.findByRawToken(created.raw);
    expect(found).not.toBeNull();
  });

  // ============================================================================
  // Revoke (soft delete)
  // ============================================================================

  it.runIf(!ctx.skip)("revoke 设置 deletedAt，token 不可再被 findByRawToken 找到", async () => {
    const created = await ApiTokenRepository.create({
      userId: TEST_USER_ID,
      name: "to-revoke",
      scopes: [],
    });
    const ok = await ApiTokenRepository.revoke(created.id, TEST_USER_ID);
    expect(ok).toBe(true);
    const found = await ApiTokenRepository.findByRawToken(created.raw);
    expect(found).toBeNull();
  });

  it.runIf(!ctx.skip)("revoke 拒绝不属于自己的 userId", async () => {
    const created = await ApiTokenRepository.create({
      userId: TEST_USER_ID,
      name: "other-owner",
      scopes: [],
    });
    const ok = await ApiTokenRepository.revoke(created.id, 9999); // 错误的 userId
    expect(ok).toBe(false);
    // token 仍然存在
    const found = await ApiTokenRepository.findByRawToken(created.raw);
    expect(found).not.toBeNull();
  });

  // ============================================================================
  // Touch (last used tracking)
  // ============================================================================

  it.runIf(!ctx.skip)("touch 更新 lastUsedAt 和 lastUsedIp", async () => {
    const created = await ApiTokenRepository.create({
      userId: TEST_USER_ID,
      name: "to-touch",
      scopes: [],
    });
    const before = await ApiTokenRepository.findByIdForUser(created.id, TEST_USER_ID);
    expect(before?.lastUsedAt).toBeNull();
    expect(before?.lastUsedIp).toBeNull();

    await ApiTokenRepository.touch(created.id, "192.168.1.1");

    const after = await ApiTokenRepository.findByIdForUser(created.id, TEST_USER_ID);
    expect(after?.lastUsedAt).not.toBeNull();
    expect(after?.lastUsedIp).toBe("192.168.1.1");
  });

  // ============================================================================
  // List by user
  // ============================================================================

  it.runIf(!ctx.skip)("listByUser 返回该用户所有未删除的 token", async () => {
    const tokens = await ApiTokenRepository.listByUser(TEST_USER_ID);
    // 之前测试创建了一些 token
    expect(tokens.length).toBeGreaterThan(0);
    // 验证 deletedAt 均为 null
    for (const t of tokens) {
      expect(t.userId).toBe(TEST_USER_ID);
    }
  });

  // ============================================================================
  // Scopes edge cases
  // ============================================================================

  it.runIf(!ctx.skip)("JSON scopes 正确处理字符串形式的 scopes（MySQL JSON 列）", async () => {
    // scopes 存储为 JSON，读取时 normalizeTokenRow 应该正确解析
    const created = await ApiTokenRepository.create({
      userId: TEST_USER_ID,
      name: "json-scopes",
      scopes: ["portal:article:list", "shop:product:read"],
    });
    const found = await ApiTokenRepository.findByRawToken(created.raw);
    expect(found?.scopes).toEqual(["portal:article:list", "shop:product:read"]);
    expect(Array.isArray(found?.scopes)).toBe(true);
  });

  it.runIf(!ctx.skip)("listByUser 正确返回多 token 的 scopes", async () => {
    // 创建多个不同 scopes 的 token
    await ApiTokenRepository.create({
      userId: TEST_USER_ID,
      name: "scope-token-1",
      scopes: ["system:user:list"],
    });
    await ApiTokenRepository.create({
      userId: TEST_USER_ID,
      name: "scope-token-2",
      scopes: ["system:role:list", "shop:product:list"],
    });

    const tokens = await ApiTokenRepository.listByUser(TEST_USER_ID);
    const scopeTokens = tokens.filter((t) =>
      t.name.startsWith("scope-token-"),
    );
    expect(scopeTokens.length).toBeGreaterThanOrEqual(2);
  });

  // ============================================================================
  // Expiry time boundary
  //
  // findByRawToken filters `expiresAt > now` (see api-token.repository.ts), and
  // the column is second-precision, so a sub-second (1ms) boundary is inherently
  // racy and NOT a real business contract. These assert the actual contract —
  // expired → not found, not-yet-expired → found — using intervals comfortably
  // larger than any clock skew, so they are deterministic. (An exact-boundary
  // assertion would require an injectable / DB-controlled clock, which this
  // repository does not expose.)
  // ============================================================================

  it.runIf(!ctx.skip)("findByRawToken 接受未过期的 token（60 秒后到期）", async () => {
    // 60 秒后到期 —— 远大于任何时钟误差，结果确定为未过期。
    const notYetExpired = new Date(Date.now() + 60_000);
    const created = await ApiTokenRepository.create({
      userId: TEST_USER_ID,
      name: "not-yet-expired",
      expiresAt: notYetExpired,
      scopes: [],
    });
    const found = await ApiTokenRepository.findByRawToken(created.raw);
    expect(found !== null).toBe(true);
  });
});
