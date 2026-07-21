/**
 * health.ts — Section 7 安全可观测性：数据库连通性 health check。
 *
 * GET /api/health：返回服务运行状态 + 数据库连通性 + 版本信息。
 *   - `db.ok = true` 表示对 MySQL 执行 `SELECT 1` 成功；
 *   - 整体 status = 'degraded' 表示带病运行（db 不通），由 K8s livenessProbe
 *     之外的 readinessProbe 使用。
 *
 * 注意：根路径 GET / 由 static.ts redirect 到 /admin/，不要再注册到这里。
 */

import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { createRouteRegistrar } from '../route-registrar.js';
import { dateUtils } from "../../../utils/date.js";
import { ResponseUtil } from "../../../utils/response.js";
import { drizzleDb } from "../../../db/index.js";
import { registerPermissions, type PermissionRef } from '../../permissions/catalog.js';

const PERMS: { readonly [k: string]: PermissionRef } = Object.freeze({
  HEALTH: { code: 'system:health', label: '系统-健康检查', group: 'system' },
});
registerPermissions(...Object.values(PERMS));

/** 简单 SELECT 1 测试连通性，超时 1.5s */
async function checkDb(): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
  const start = Date.now();
  try {
    await drizzleDb.execute("SELECT 1");
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

const health: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  const route = createRouteRegistrar(fastify);
  route.get(
    "/health",
    {
      access: { permission: PERMS.HEALTH },
      schema: {
        summary: "服务健康检查",
        description:
          "返回服务的健康状态、版本号、当前时间和数据库连通性（Section 7）。",
        operationId: "healthCheck",
        tags: ["system"],
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              code: { type: "number" },
              message: { type: "string" },
              data: {
                type: "object",
                properties: {
                  status: { type: "string" },
                  version: { type: "string" },
                  commitSha: { type: "string" },
                  uptimeSeconds: { type: "number" },
                  timestamp: { type: "string" },
                  db: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean" },
                      latencyMs: { type: "number" },
                      error: { type: "string" },
                    },
                  },
                },
              },
              timestamp: { type: "string" },
            },
          },
        },
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const dbCheck = await checkDb();
      const commitSha =
        process.env.GIT_COMMIT_SHA ??
        // Fallback: local git HEAD (12-char)
        (await import("node:child_process"))
          .execSync("git rev-parse --short=12 HEAD 2>/dev/null || echo unknown", {
            encoding: "utf8",
          })
          .trim();
      const payload = {
        status: dbCheck.ok ? "ok" : "degraded",
        version: process.env.npm_package_version ?? "0.0.0",
        commitSha,
        uptimeSeconds: Math.round(process.uptime()),
        timestamp: dateUtils.now(),
        db: dbCheck,
      };
      const message = dbCheck.ok ? "Service is healthy" : "Service degraded";
      return ResponseUtil.success(reply, payload, message);
    },
  );
};

export default health;
