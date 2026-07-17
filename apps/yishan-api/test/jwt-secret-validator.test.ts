/**
 * JWT Secret Validator 单元测试
 *
 * Section 2 — 覆盖六种组合：
 *   - 空 / 默认 / 短 / 长 secret
 *   - 生产 / 非生产
 *   - JWT_ALLOW_WEAK_SECRET 开 / 关
 *
 * 实现允许通过 options.secret 覆盖当前进程的 JWT_CONFIG.secret，避免依赖
 * 真实环境变量。
 */

import { describe, expect, it } from "vitest";
import { assertJwtSecretOrThrow } from "../src/core/plugins/external/jwt-secret-validator.js";

describe("jwt-secret-validator: assertJwtSecretOrThrow", () => {
  it("production + empty secret throws", () => {
    expect(() =>
      assertJwtSecretOrThrow({ env: "production", allowWeak: false, secret: "" }),
    ).toThrowError(/JWT_SECRET is empty/);
  });

  it("development + empty secret returns ok=false (no throw)", () => {
    const result = assertJwtSecretOrThrow({
      env: "development",
      allowWeak: false,
      secret: "",
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/empty/i);
  });

  it("production + default placeholder secret throws", () => {
    expect(() =>
      assertJwtSecretOrThrow({
        env: "production",
        allowWeak: false,
        secret: "your-secret-key-change-this-in-production",
      }),
    ).toThrowError(/placeholder default/);
  });

  it("production + short secret throws", () => {
    expect(() =>
      assertJwtSecretOrThrow({
        env: "production",
        allowWeak: false,
        secret: "JWT_SECRET",
      }),
    ).toThrowError(/at least 32 characters/);
  });

  it("development + short secret returns ok=false (no throw) — fixes the dev blocker", () => {
    const result = assertJwtSecretOrThrow({
      env: "development",
      allowWeak: false,
      secret: "JWT_SECRET", // 11 字符
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/32 characters/);
  });

  it("JWT_ALLOW_WEAK_SECRET=1 + short secret returns ok=true", () => {
    const result = assertJwtSecretOrThrow({
      env: "development",
      allowWeak: true,
      secret: "JWT_SECRET",
    });
    expect(result.ok).toBe(true);
  });

  it("production + allowWeak=true bypasses weak-secret block", () => {
    const result = assertJwtSecretOrThrow({
      env: "production",
      allowWeak: true,
      secret: "JWT_SECRET",
    });
    expect(result.ok).toBe(true);
  });

  it("production + long strong secret returns ok=true", () => {
    const result = assertJwtSecretOrThrow({
      env: "production",
      allowWeak: false,
      secret: "a".repeat(64),
    });
    expect(result.ok).toBe(true);
  });
});