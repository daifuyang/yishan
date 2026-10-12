import { currentSystemRuntime } from '@/runtime'
/** 生产密钥检查先于资源连接执行；开发覆盖开关不能绕过生产安全门禁。 */

import { JWT_CONFIG } from "../../../config/index.js";

const DEFAULT_SECRETS = [
  "your-secret-key-change-this-in-production",
  "your-jwt-secret-change-this-in-production",
  "replace-with-a-long-random-secret",
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
 * @param options.env env 字符串，缺省取 currentSystemRuntime().config.APP_CONFIG.nodeEnv
 * @param options.allowWeak 是否放行弱 secret；缺省读 JWT_ALLOW_WEAK_SECRET === "1"
 * @param options.secret 可选：直接传入 secret 字符串，跳过 JWT_CONFIG 读取（便于单测）
 */
export function assertJwtSecretOrThrow(
  options: { env?: string; allowWeak?: boolean; secret?: string } = {},
): JwtSecretCheckResult {
  const env = options.env ?? currentSystemRuntime().config.APP_CONFIG.nodeEnv ?? "development";
  const allowWeak = options.allowWeak ?? currentSystemRuntime().config.allowWeakJwt;
  const isProduction = env === "production";

  const secret = options.secret ?? JWT_CONFIG.secret;

  if (!secret || typeof secret !== "string") {
    const reason = "JWT_SECRET is empty";
    if (isProduction) {
      throw new Error(`[jwt-secret-validator] ${reason}. Refusing to start.`);
    }
    return { ok: false, reason };
  }

  if (allowWeak && !isProduction) {
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
