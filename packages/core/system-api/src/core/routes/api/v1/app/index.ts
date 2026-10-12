import { createRouteRegistrar } from '@yishan/core-api/routes/route-registrar';
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { ResponseUtil } from "@yishan/core-api/response";
import dashboard from "./dashboard/index.js";
import { registerRoutePermissions as registerPermissions } from '@/route-permissions'
import type { PermissionRef } from '@yishan/core-api/permissions/catalog';

const PERMS: { readonly [k: string]: PermissionRef } = Object.freeze({
  ROOT: { code: 'app:root', label: '移动端根信息', group: 'app' },
});

/**
 * 移动端根路由 - /api/v1/app
 * 用于 health check / welcome
 */
const appRoot: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  registerPermissions(...Object.values(PERMS));
  const route = createRouteRegistrar(fastify);
  await fastify.register(dashboard);

  route.get(
    "/",
    {
      access: { permission: PERMS.ROOT },
      schema: {
        summary: "移动端根",
        description: "返回移动端基座的基本信息",
        operationId: "appRoot",
        tags: ["app"],
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
                  name: { type: "string" },
                  version: { type: "string" },
                  time: { type: "string" },
                },
              },
              timestamp: { type: "string" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return ResponseUtil.success(
        reply,
        {
          name: "yishan-app",
          version: "0.1.0",
          time: new Date().toISOString(),
        },
        "yishan app channel ready"
      );
    }
  );
};

export default appRoot;
