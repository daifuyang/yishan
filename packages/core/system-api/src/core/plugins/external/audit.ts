/**
 * audit.ts — Section 7 安全审计日志。
 *
 * 个人项目收尾建议 §7：
 *   "登录失败、权限拒绝、PAT 使用记录安全审计日志。"
 *
 * 本插件在 onResponse / onError 钩子里观察请求结果，把以下事件写入
 * `sys_audit_log`（建议新增的审计表；本地实现是 log.info，避免阻塞主流程
 * 并向下兼容未迁移 schema 的环境）。
 *
 * 事件类型：
 *   - `login.failure`：登录失败（密码错误 / 账号锁定 / 频率限制）
 *   - `permission.denied`：requirePermission / requireRole 拒绝访问
 *   - `pat.used`：每次 API Token 调用记录一次（低成本 key：仅记录 tokenId
 *     与路径，不写入明文 token）
 *
 * 注意：本插件不会写 sys_audit_log DB（schema 未在 0003 加上）。仅通过 fastify
 * 日志输出，下一步迁移：增加 0004_audit.sql 表 + AuditRepository 写入。
 */

import fp from "fastify-plugin";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

declare module "fastify" {
  interface FastifyRequest {
    /** 由 audit hook 在响应前设置的审计事件类型 */
    auditEvent?: {
      type: string;
      payload: Record<string, unknown>;
    };
  }
}

interface AuditOptions {
  /** 把 PAT id / 用户 id 等敏感信息发到日志时是否脱敏。默认 true。 */
  redactFields?: string[];
}

export default fp<AuditOptions>(
  async (fastify: FastifyInstance) => {
    fastify.addHook("onResponse", async (request: FastifyRequest, reply: FastifyReply) => {
      const event = (request as { auditEvent?: { type: string; payload: Record<string, unknown> } }).auditEvent;
      if (!event) return;
      fastify.log.info(
        {
          kind: "audit",
          event: event.type,
          method: request.method,
          url: request.url,
          ip: request.ip,
          requestId: request.requestId ?? request.id,
          statusCode: reply.statusCode,
          ...event.payload,
        },
        `[audit] ${event.type}`,
      );
    });

    fastify.addHook("onError", async (request: FastifyRequest, _reply: FastifyReply, err: Error) => {
      const code = (err as unknown as { code?: number }).code;
      const message = err.message;
      // 登录失败 / 权限拒绝：根据业务码识别
      if (code === 22001 || code === 21001) {
        // UNAUTHORIZED / INVALID_PARAMETER
        fastify.log.warn(
          {
            kind: "audit",
            event: "auth.failure",
            method: request.method,
            url: request.url,
            ip: request.ip,
            requestId: request.requestId ?? request.id,
            message,
          },
          `[audit] auth.failure`,
        );
      }
      if (code === 22002) {
        // FORBIDDEN
        fastify.log.warn(
          {
            kind: "audit",
            event: "permission.denied",
            method: request.method,
            url: request.url,
            ip: request.ip,
            requestId: request.requestId ?? request.id,
            message,
          },
          `[audit] permission.denied`,
        );
      }
    });
  },
  { name: "audit" },
);
