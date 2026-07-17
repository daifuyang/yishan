/**
 * rate-limit.ts — Section 7 限流。
 *
 * 个人项目收尾建议 §7：对 login、refresh、PAT 创建接口增加限流。
 *
 * 实现要点：
 *   - 进程内 sliding window（Map<key, timestamps[]>）。生产环境如启用 Redis
 *     可替换为 @fastify/rate-limit；此处保持零依赖。
 *   - 按 IP + endpoint 类型组合 key，避免跨端点互相影响。
 *   - 默认阈值：login 5/min、refresh 30/min、PAT 创建 10/min。阈值可通过
 *     环境变量覆盖：LOGIN_RATELIMIT_PER_MIN、REFRESH_RATELIMIT_PER_MIN、
 *     PAT_CREATE_RATELIMIT_PER_MIN。
 *   - 命中限流时抛 BusinessError(SystemErrorCode.TOO_MANY_REQUESTS, 429)。
 */

import fp from "fastify-plugin";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { BusinessError } from "../../../exceptions/business-error.js";
import { ValidationErrorCode } from "../../../constants/business-codes/validation.js";

interface Bucket {
  timestamps: number[];
}

const WINDOW_MS = 60_000;

function readEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const DEFAULT_LIMITS = {
  login: readEnv("LOGIN_RATELIMIT_PER_MIN", 5),
  refresh: readEnv("REFRESH_RATELIMIT_PER_MIN", 30),
  patCreate: readEnv("PAT_CREATE_RATELIMIT_PER_MIN", 10),
};

function takeToken(bucket: Bucket, maxTokens: number, now: number): boolean {
  // Drop old timestamps (> window)
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < WINDOW_MS);
  if (bucket.timestamps.length >= maxTokens) return false;
  bucket.timestamps.push(now);
  return true;
}

declare module "fastify" {
  interface FastifyInstance {
    /** Limit IP+endpoint to N requests per minute. Apply as a preHandler. */
    rateLimit: (
      kind: keyof typeof DEFAULT_LIMITS | { kind: string; maxPerMin: number },
      opts?: { max?: number; prefix?: string },
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void> | void;
  }
}

export default fp(
  async (fastify: FastifyInstance) => {
    const buckets = new Map<string, Bucket>();

    fastify.decorate(
      "rateLimit",
      (
        kindOrConfig: keyof typeof DEFAULT_LIMITS | { kind: string; maxPerMin: number },
        opts: { max?: number; prefix?: string } = {},
      ) => {
        const cfg =
          typeof kindOrConfig === "string"
            ? { kind: kindOrConfig, maxPerMin: opts.max ?? DEFAULT_LIMITS[kindOrConfig] }
            : { ...kindOrConfig, maxPerMin: opts.max ?? kindOrConfig.maxPerMin };
        return async (request: FastifyRequest, _reply: FastifyReply) => {
          const ip = request.ip ?? "unknown";
          const prefix = opts.prefix ?? `${cfg.kind}|`;
          const key = prefix + ip;
          let bucket = buckets.get(key);
          if (!bucket) {
            bucket = { timestamps: [] };
            buckets.set(key, bucket);
          }
          const ok = takeToken(bucket, cfg.maxPerMin, Date.now());
          if (!ok) {
            throw new BusinessError(
              ValidationErrorCode.TOO_MANY_REQUESTS,
              `请求过于频繁，请稍后再试 (${cfg.kind}, limit=${cfg.maxPerMin}/min)`,
            );
          }
        };
      },
    );

    // Best-effort: periodically clear buckets that have aged out.
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, bucket] of buckets) {
        bucket.timestamps = bucket.timestamps.filter((t) => now - t < WINDOW_MS);
        if (bucket.timestamps.length === 0) buckets.delete(key);
      }
    }, WINDOW_MS);
    cleanupInterval.unref?.();
    fastify.addHook("onClose", async () => {
      clearInterval(cleanupInterval);
    });
  },
  { name: "rate-limit" },
);
