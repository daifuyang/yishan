import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { ResponseUtil } from "../../../../../utils/response.js";
import { SystemOptionService } from "../../../../../services/system-option.service.js";
import { getSystemMessage, SystemMessageKeys } from "../../../../../constants/messages/system.js";

export const adminSystem: FastifyPluginAsync = async (fastify) => {
  // 获取系统参数
  fastify.get(
    "/options/:key",
    {
      schema: {
        summary: "获取系统参数",
        description: "根据键获取系统参数值",
        operationId: "getSystemOption",
        tags: ["system"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: { key: { $ref: "systemOptionKey#" } },
          required: ["key"],
        },
        response: { 200: { $ref: "getSystemOptionResp#" } },
      },
    },
    async (request: FastifyRequest<{ Params: { key: "defaultArticleTemplateId" | "defaultPageTemplateId" } }>, reply: FastifyReply) => {
      const value = await SystemOptionService.getOption(request.params.key);
      const message = getSystemMessage(SystemMessageKeys.SYSTEM_OPTION_GET_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, value ?? null, message);
    }
  );

  // 设置系统参数
  fastify.put(
    "/options/:key",
    {
      schema: {
        summary: "设置系统参数",
        description: "根据键设置系统参数值",
        operationId: "setSystemOption",
        tags: ["system"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: { key: { $ref: "systemOptionKey#" } },
          required: ["key"],
        },
        body: { $ref: "setSystemOptionReq#" },
        response: { 200: { $ref: "getSystemOptionResp#" } },
      },
    },
    async (request: FastifyRequest<{ Params: { key: "defaultArticleTemplateId" | "defaultPageTemplateId" }; Body: { value: number } }>, reply: FastifyReply) => {
      const value = await SystemOptionService.setOption(request.params.key, request.body.value, request.currentUser.id);
      const message = getSystemMessage(SystemMessageKeys.SYSTEM_OPTION_SET_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, value, message);
    }
  );
};
