import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { Type } from "@sinclair/typebox";
import { ResponseUtil } from "../../../../../../utils/response.js";
import { DictService } from "../../../../../services/dict.service.js";

/**
 * 移动端字典路由 - /api/v1/app/dicts
 * 暴露按 type 查询的字典数据，便于移动端下拉、单选等
 */
const dicts: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  // GET /api/v1/app/dicts/:type - 按 type 查询字典数据
  fastify.get(
    "/:type",
    {
      preHandler: fastify.authenticate,
      schema: {
        summary: "按类型查询字典数据（移动端）",
        description: "根据字典类型（type）返回启用状态的字典数据列表",
        operationId: "appGetDictByType",
        tags: ["app-dicts"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({
          type: Type.String({ minLength: 1, maxLength: 100 }),
        }),
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              code: { type: "number" },
              message: { type: "string" },
              data: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "number" },
                    typeId: { type: "number" },
                    type: { type: "string" },
                    label: { type: "string" },
                    value: { type: "string" },
                    tag: { type: "string" },
                    sortOrder: { type: "number" },
                    isDefault: { type: "boolean" },
                  },
                },
              },
              timestamp: { type: "string" },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      const { type } = request.params as { type: string };
      // 走 list 查询过滤 type
      const { list } = await DictService.getDictDataList({
        page: 1,
        pageSize: 200,
        type,
        sortBy: "sortOrder",
        sortOrder: "asc",
      } as any);
      const data = list
        .filter((d) => d.status === 1)
        .map((d) => ({
          id: d.id,
          typeId: d.typeId,
          type: d.type,
          label: d.label,
          value: d.value,
          tag: d.tag ?? "",
          sortOrder: d.sort_order,
          isDefault: !!d.isDefault,
        }));
      return ResponseUtil.success(reply, data, "获取字典数据成功");
    }
  );

  // GET /api/v1/app/dicts - 全量字典映射（缓存友好）
  fastify.get(
    "/",
    {
      preHandler: fastify.authenticate,
      schema: {
        summary: "获取全量字典映射（移动端）",
        description: "返回 { [type]: [{label, value}] } 的字典映射，移动端可一次性加载",
        operationId: "appGetAllDictMap",
        tags: ["app-dicts"],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              code: { type: "number" },
              message: { type: "string" },
              data: { type: "object", additionalProperties: true },
              timestamp: { type: "string" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const map = await DictService.getAllDictDataMap(fastify);
      return ResponseUtil.success(reply, map, "获取字典映射成功");
    }
  );
};

export default dicts;
