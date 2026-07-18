import { createRouteRegistrar } from '../../../route-registrar.js';
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { ResponseUtil } from "../../../../../utils/response.js";
import dashboard from "./dashboard/index.js";

/**
 * 移动端根路由 - /api/v1/app
 * 用于 health check / welcome
 */
const appRoot: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  const route = createRouteRegistrar(fastify);
  await fastify.register(dashboard);

  route.get(
    "/",
    {
      access: 'public',
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
