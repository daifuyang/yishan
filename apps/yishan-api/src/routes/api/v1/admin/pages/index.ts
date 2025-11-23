import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { Type } from "@sinclair/typebox";
import { ResponseUtil } from "../../../../../utils/response.js";
import { PageService } from "../../../../../services/page.service.js";
import { getPageMessage, PageMessageKeys } from "../../../../../constants/messages/page.js";
import { PageListQuery, CreatePageReq, UpdatePageReq } from "../../../../../schemas/page.js";

const adminPages: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.get(
    "/",
    {
      schema: {
        summary: "获取页面列表",
        description: "分页获取门户页面列表，支持关键词与状态筛选",
        operationId: "getPageList",
        tags: ["portalPages"],
        security: [{ bearerAuth: [] }],
        querystring: { $ref: "pageListQuery#" },
        response: { 200: { $ref: "pageListResp#" } },
      },
    },
    async (request: FastifyRequest<{ Querystring: PageListQuery }>, reply: FastifyReply) => {
      const { page, pageSize } = request.query;
      const result = await PageService.getPageList(request.query);
      const message = getPageMessage(PageMessageKeys.LIST_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.paginated(reply, result.list, page || 1, pageSize || 10, result.total, message);
    }
  );

  fastify.get(
    "/:id",
    {
      schema: {
        summary: "获取页面详情",
        description: "根据页面ID获取页面详情",
        operationId: "getPageDetail",
        tags: ["portalPages"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.Integer({ description: "页面ID", minimum: 1 }) }),
        response: { 200: { $ref: "pageDetailResp#" } },
      },
    },
    async (request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) => {
      const page = await PageService.getPageById(request.params.id);
      const message = getPageMessage(PageMessageKeys.DETAIL_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, page, message);
    }
  );

  fastify.post(
    "/",
    {
      schema: {
        summary: "创建页面",
        description: "创建一个新的门户页面，支持自定义属性",
        operationId: "createPage",
        tags: ["portalPages"],
        security: [{ bearerAuth: [] }],
        body: { $ref: "createPageReq#" },
        response: { 200: { $ref: "pageDetailResp#" } },
      },
    },
    async (request: FastifyRequest<{ Body: CreatePageReq }>, reply: FastifyReply) => {
      const page = await PageService.createPage(request.body, request.currentUser.id);
      const message = getPageMessage(PageMessageKeys.CREATE_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, page, message);
    }
  );

  fastify.put(
    "/:id",
    {
      schema: {
        summary: "更新页面",
        description: "根据页面ID更新页面信息",
        operationId: "updatePage",
        tags: ["portalPages"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.Integer({ description: "页面ID", minimum: 1 }) }),
        body: { $ref: "updatePageReq#" },
        response: { 200: { $ref: "pageDetailResp#" } },
      },
    },
    async (request: FastifyRequest<{ Params: { id: number }; Body: UpdatePageReq }>, reply: FastifyReply) => {
      const page = await PageService.updatePage(request.params.id, request.body, request.currentUser.id);
      const message = getPageMessage(PageMessageKeys.UPDATE_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, page, message);
    }
  );

  fastify.delete(
    "/:id",
    {
      schema: {
        summary: "删除页面",
        description: "根据页面ID进行软删除",
        operationId: "deletePage",
        tags: ["portalPages"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.Integer({ description: "页面ID", minimum: 1 }) }),
        response: { 200: { $ref: "pageDeleteResp#" } },
      },
    },
    async (request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) => {
      const result = await PageService.deletePage(request.params.id);
      const message = getPageMessage(PageMessageKeys.DELETE_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, result, message);
    }
  );
};

export default adminPages;
