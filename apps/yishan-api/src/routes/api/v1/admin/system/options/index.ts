import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { ResponseUtil } from "../../../../../../utils/response.js";
import { SystemOptionService } from "../../../../../../services/system-option.service.js";
import {
  getSystemMessage,
  SystemMessageKeys,
} from "../../../../../../constants/messages/system.js";

const adminSystemOptions: FastifyPluginAsync = async (fastify) => {
  // 获取系统参数
  fastify.get(
    "/:key",
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
    async (request: FastifyRequest, reply: FastifyReply) => {
      const value = await SystemOptionService.getOption(
        (request.params as any).key
      );
      const message = getSystemMessage(
        SystemMessageKeys.SYSTEM_OPTION_GET_SUCCESS,
        request.headers["accept-language"] as string
      );
      return ResponseUtil.success(reply, value ?? null, message);
    }
  );

  // 批量获取系统参数（QueryString 多 key）
  fastify.get(
    "/query",
    {
      schema: {
        summary: "批量获取系统参数（QueryString）",
        description: "通过 query 参数 ?key[]=a&key[]=b 批量获取系统参数值",
        operationId: "batchGetSystemOptionByQuery",
        tags: ["system"],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            "key[]": {
              type: "array",
              items: { $ref: "systemOptionKey#" },
              minItems: 1,
              description: "通过数组语法传参：?key[]=a&key[]=b",
            },
          },
          required: ["key[]"],
        },
        response: { 200: { $ref: "batchGetSystemOptionResp#" } },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const qs = request.query as any;
      const keys = (qs?.["key[]"] || []) as string[];
      const map = await SystemOptionService.getOptions(keys as any);
      const results = keys.map((k: string) => ({
        key: k,
        value: (map as any)[k] ?? null,
      }));
      const message = getSystemMessage(
        SystemMessageKeys.SYSTEM_OPTION_GET_SUCCESS,
        request.headers["accept-language"] as string
      );
      return ResponseUtil.success(reply, { results }, message);
    }
  );

  // 设置系统参数
  fastify.put(
    "/:key",
    {
      preHandler: fastify.authenticate,
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
    async (request: FastifyRequest, reply: FastifyReply) => {
      const value = await SystemOptionService.setOption(
        (request.params as any).key,
        (request.body as any).value,
        (request as any).currentUser.id
      );
      const message = getSystemMessage(
        SystemMessageKeys.SYSTEM_OPTION_SET_SUCCESS,
        request.headers["accept-language"] as string
      );
      return ResponseUtil.success(reply, value, message);
    }
  );

  // 批量设置系统参数
  fastify.post(
    "/batch",
    {
      preHandler: fastify.authenticate,
      schema: {
        summary: "批量设置系统参数",
        description: "传入JSON数组批量新增或更新系统参数",
        operationId: "batchSetSystemOption",
        tags: ["system"],
        security: [{ bearerAuth: [] }],
        body: { $ref: "batchSetSystemOptionReq#" },
        response: { 200: { $ref: "batchSetSystemOptionResp#" } },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const items =
        (request.body as Array<{
          key: Parameters<typeof SystemOptionService.setOption>[0];
          value: string;
        }>) || [];
      const results: Array<{
        key: Parameters<typeof SystemOptionService.setOption>[0];
        value: string;
        success: boolean;
        code?: number;
        message?: string;
      }> = [];
      let updatedCount = 0;
      for (const item of items) {
        try {
          const v = await SystemOptionService.setOption(
            item.key,
            item.value,
            request.currentUser.id
          );
          results.push({ key: item.key, value: v, success: true });
          updatedCount++;
        } catch (err: any) {
          const code = typeof err?.code === "number" ? err.code : 20001; // SystemErrorCode.SYSTEM_ERROR
          const message =
            typeof err?.message === "string" ? err.message : "设置失败";
          results.push({
            key: item.key,
            value: item.value,
            success: false,
            code,
            message,
          });
        }
      }
      const message = getSystemMessage(
        SystemMessageKeys.SYSTEM_OPTION_SET_SUCCESS,
        request.headers["accept-language"] as string
      );
      return ResponseUtil.success(reply, { updatedCount, results }, message);
    }
  );
};

export default adminSystemOptions;
