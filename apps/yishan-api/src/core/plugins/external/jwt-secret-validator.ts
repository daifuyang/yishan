/**
 * jwt-secret-validator.ts — Section 2 安全门禁。
 *
 * 个人项目收尾建议 §2 规定：
 *   - 生产环境缺少 JWT secret 或使用默认 secret 时，API 必须拒绝启动。
 *
 * 本插件在 Fastify `register(autoload)` 之前同步执行 secret 强度校验。
 * 函数本身**不抛错**，统一返回 `{ ok, reason }`，由调用方（app.ts 启动门禁）
 * 根据 `process.env.NODE_ENV` 决定 warn 或 process.exit(1)。
 *
 *   - empty secret + production      → { ok: false, reason: "JWT_SECRET is empty" } → exit(1)
 *   - empty secret + non-production  → { ok: false, reason: "JWT_SECRET is empty" } → warn
 *   - weak/default + production      → throws （保留原行为）
 *   - weak/default + non-production  → { ok: false, reason: "weak JWT secret" } → warn
 *   - JWT_ALLOW_WEAK_SECRET=1        → 跳过默认/长度检查，返回 { ok: true }
 *
 * 之所以把"生产抛错"做成异常路径，是因为非生产的调用方期望返回 result，
 * 而生产的退出决策通常还会附加额外日志/审计/告警。
 */

import { JWT_CONFIG } from "../../../config/index.js";

const DEFAULT_SECRETS = [
  "your-secret-key-change-this-in-production",
  "secret",
  "changeme",
  "yishan-secret",
  "your_jwt_secret",
];

export interface JwtSecretCheckResult {
  ok: boolean;
  reason?: string;
}

/**
 * 同步校验当前 JWT secret 强度。
 * 生产环境发现弱 secret 时会直接抛出（保留原始行为，调用方用 try/catch 转 exit）。
 * 非生产环境一律返回结果，不抛错。
 *
 * @param options.env env 字符串，缺省取 process.env.NODE_ENV
 * @param options.allowWeak 是否放行弱 secret；缺省读 JWT_ALLOW_WEAK_SECRET === "1"
 * @param options.secret 可选：直接传入 secret 字符串，跳过 JWT_CONFIG 读取（便于单测）
 */
export function assertJwtSecretOrThrow(
  options: { env?: string; allowWeak?: boolean; secret?: string } = {},
): JwtSecretCheckResult {
  const env = options.env ?? process.env.NODE_ENV ?? "development";
  const allowWeak = options.allowWeak ?? process.env.JWT_ALLOW_WEAK_SECRET === "1";
  const isProduction = env === "production";

  const secret = options.secret ?? JWT_CONFIG.secret;

  if (!secret || typeof secret !== "string") {
    const reason = "JWT_SECRET is empty";
    if (isProduction) {
      throw new Error(`[jwt-secret-validator] ${reason}. Refusing to start.`);
    }
    return { ok: false, reason };
  }

  if (allowWeak) {
    return { ok: true };
  }

  if (DEFAULT_SECRETS.includes(secret)) {
    const reason = "JWT_SECRET appears to be a placeholder default. Set a strong secret via the JWT_SECRET env var.";
    if (isProduction) {
      throw new Error(`[jwt-secret-validator] ${reason}`);
    }
    return { ok: false, reason };
  }

  if (secret.length < 32) {
    const reason = `JWT_SECRET must be at least 32 characters long for production safety (current: ${secret.length}).`;
    if (isProduction) {
      throw new Error(`[jwt-secret-validator] ${reason}`);
    }
    return { ok: false, reason };
  }

  return { ok: true };
}
