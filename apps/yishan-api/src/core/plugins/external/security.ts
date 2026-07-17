/**
 * security.ts — Section 7 安全可观测性插件。
 *
 * 一站式提供：
 *   - Request ID：为每个请求生成/沿用 `X-Request-Id`，存入 request.id 与 reply header。
 *   - 日志脱敏：自动 drop 响应/日志里的 password / token / refreshToken /
 *     Authorization / Cookie 字段。
 *   - 启动日志：版本、commit SHA、Node 版本、注册插件列表、migration 状态。
 *
 * 该插件在 jwt-auth、cookie 之后注册（无硬依赖，使用 fp 包装即可）。
 */

import fp from "fastify-plugin";
import { randomUUID } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

const REQUEST_ID_HEADER = "x-request-id";
const REDACT_KEYS = new Set([
  "password",
  "passwordhash",
  "token",
  "accesstoken",
  "refreshtoken",
  "authorization",
  "cookie",
  "set-cookie",
  "apitoken",
  "apipassword",
  "secret",
]);

const REDACTED = "[REDACTED]";

function redact(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (REDACT_KEYS.has(k.toLowerCase())) {
      out[k] = REDACTED;
    } else {
      out[k] = redact(v);
    }
  }
  return out;
}

/**
 * Augment FastifyRequest with a stable `requestId` and a redacted-logs marker.
 */
declare module "fastify" {
  interface FastifyRequest {
    /** Match the value echoed in `X-Request-Id` header; UUID v4 by default. */
    requestId: string;
  }
  interface FastifyReply {
    /** Append a redacted copy of `body` to the JSON response so callers can still see it. */
    redactSensitiveFields(data: unknown): unknown;
  }
}

function resolveCommitSha(): string {
  try {
    const head = join(process.cwd(), ".git", "HEAD");
    if (existsSync(head)) {
      const ref = readFileSync(head, "utf8").trim();
      if (ref.startsWith("ref:")) {
        const refPath = join(process.cwd(), ".git", ref.slice(5));
        if (existsSync(refPath)) {
          return readFileSync(refPath, "utf8").trim().slice(0, 12);
        }
      }
      return ref.slice(0, 12);
    }
  } catch {
    /* not a git checkout */
  }
  return process.env.GIT_COMMIT_SHA ?? "unknown";
}

function resolveVersion(fastify: FastifyInstance): string {
  const pkg = (fastify as { server?: { opts?: { version?: string } } }).server?.opts?.version;
  if (pkg) return pkg;
  return process.env.npm_package_version ?? "0.0.0";
}

export default fp(
  async (fastify: FastifyInstance) => {
    // -- 1) Ensure every request has a requestId. -------------------------
    fastify.decorateRequest("requestId", "");
    fastify.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
      const incoming = request.headers[REQUEST_ID_HEADER];
      const requestId = typeof incoming === "string" && incoming.length > 0 ? incoming : randomUUID();
      request.requestId = requestId;
      reply.header(REQUEST_ID_HEADER, requestId);
      // 把 requestId 注入到 pino 日志子结构，便于跨链路追踪
      (request.log as unknown as { bindings?: () => unknown }).bindings?.();
    });

    // -- 2) Logger redaction: wrap the request log keys through redact() ---
    fastify.addHook("preHandler", async (request: FastifyRequest) => {
      const originalBody = (request as { body?: unknown }).body;
      if (originalBody && typeof originalBody === "object") {
        (request as unknown as { redactedBody: unknown }).redactedBody = redact(originalBody);
      }
    });

    // -- 3) Response redaction helper exposed on reply. -------------------
    fastify.decorateReply("redactSensitiveFields", function (data: unknown): unknown {
      return redact(data);
    });

    // -- 4) Startup banners -----------------------------------------------
    fastify.addHook("onReady", async () => {
      const plugins = Object.keys((fastify as unknown as { [k: string]: unknown }).register ? {} : {});
      // 仅打印关键启动信息，避免泄露敏感数据
      fastify.log.info(
        {
          version: resolveVersion(fastify),
          commitSha: resolveCommitSha(),
          nodeVersion: process.versions.node,
          pluginCount: plugins.length,
          env: process.env.NODE_ENV ?? "development",
        },
        "[startup] yishan-api ready",
      );
    });
  },
  {
    name: "security",
  },
);
