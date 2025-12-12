import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { Type } from "@sinclair/typebox";
import { ResponseUtil } from "../../../../../utils/response.js";
import { PageService } from "../../../../../services/page.service.js";
import { TemplateService } from "../../../../../services/template.service.js";
import { getPageMessage, PageMessageKeys } from "../../../../../constants/messages/page.js";
import { PageListQuery, CreatePageReq, UpdatePageReq } from "../../../../../schemas/page.js";
import { TemplateListQuery, CreateTemplateReq, UpdateTemplateReq, AssignTemplateReq } from "../../../../../schemas/template.js";

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

  // 模板管理（页面类型）
  fastify.get(
    "/templates",
    {
      schema: {
        summary: "获取页面模板列表",
        description: "分页获取页面模板列表",
        operationId: "getPageTemplateList",
        tags: ["portalPages"],
        security: [{ bearerAuth: [] }],
        querystring: { $ref: "templateListQuery#" },
        response: { 200: { $ref: "templateListResp#" } },
      },
    },
    async (request: FastifyRequest<{ Querystring: TemplateListQuery }>, reply: FastifyReply) => {
      const { page, pageSize } = request.query;
      const result = await TemplateService.getTemplateList({ ...request.query, type: "page" });
      const message = getPageMessage(PageMessageKeys.TEMPLATE_LIST_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.paginated(reply, result.list, page || 1, pageSize || 10, result.total, message);
    }
  );

  fastify.post(
    "/templates",
    {
      schema: {
        summary: "创建页面模板",
        description: "创建页面模板并设置结构/配置",
        operationId: "createPageTemplate",
        tags: ["portalPages"],
        security: [{ bearerAuth: [] }],
        body: { $ref: "createTemplateReq#" },
        response: { 200: { $ref: "templateDetailResp#" } },
      },
    },
    async (request: FastifyRequest<{ Body: CreateTemplateReq }>, reply: FastifyReply) => {
      const t = await TemplateService.createTemplate({ ...request.body, type: "page" }, request.currentUser.id);
      const message = getPageMessage(PageMessageKeys.TEMPLATE_CREATE_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, t, message);
    }
  );

  fastify.put(
    "/templates/:id",
    {
      schema: {
        summary: "更新页面模板",
        description: "根据ID更新页面模板",
        operationId: "updatePageTemplate",
        tags: ["portalPages"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.Integer({ description: "模板ID", minimum: 1 }) }),
        body: { $ref: "updateTemplateReq#" },
        response: { 200: { $ref: "templateDetailResp#" } },
      },
    },
    async (request: FastifyRequest<{ Params: { id: number }; Body: UpdateTemplateReq }>, reply: FastifyReply) => {
      const t = await TemplateService.updateTemplate(request.params.id, { ...request.body, type: "page" }, request.currentUser.id);
      const message = getPageMessage(PageMessageKeys.TEMPLATE_UPDATE_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, t, message);
    }
  );

  fastify.delete(
    "/templates/:id",
    {
      schema: {
        summary: "删除页面模板",
        description: "根据ID软删除页面模板",
        operationId: "deletePageTemplate",
        tags: ["portalPages"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.Integer({ description: "模板ID", minimum: 1 }) }),
        response: { 200: { $ref: "templateDeleteResp#" } },
      },
    },
    async (request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) => {
      const result = await TemplateService.deleteTemplate(request.params.id);
      const message = getPageMessage(PageMessageKeys.TEMPLATE_DELETE_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, result, message);
    }
  );

  // 设置页面模板
  fastify.patch(
    "/:id/template",
    {
      schema: {
        summary: "设置页面模板",
        description: "为页面设置或取消模板",
        operationId: "assignPageTemplate",
        tags: ["portalPages"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.Integer({ description: "页面ID", minimum: 1 }) }),
        body: { $ref: "assignTemplateReq#" },
        response: { 200: { $ref: "pageDetailResp#" } },
      },
    },
    async (request: FastifyRequest<{ Params: { id: number }; Body: AssignTemplateReq }>, reply: FastifyReply) => {
      const page = await PageService.assignTemplate(request.params.id, request.body, request.currentUser.id);
      const message = getPageMessage(PageMessageKeys.SET_TEMPLATE_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, page, message);
    }
  );

  // 模板结构：获取
  fastify.get(
    "/templates/:id/schema",
    {
      schema: {
        summary: "获取页面模板结构",
        description: "根据模板ID获取模板结构元配置",
        operationId: "getPageTemplateSchema",
        tags: ["portalPages"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.Integer({ description: "模板ID", minimum: 1 }) }),
        response: { 200: { $ref: "templateSchemaResp#" } },
      },
    },
    async (request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) => {
      const schema = await TemplateService.getTemplateSchema(request.params.id);
      const message = getPageMessage(PageMessageKeys.TEMPLATE_SCHEMA_GET_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, schema, message);
    }
  );

  // 模板结构：更新
  fastify.put(
    "/templates/:id/schema",
    {
      schema: {
        summary: "更新页面模板结构",
        description: "根据模板ID更新模板结构元配置",
        operationId: "updatePageTemplateSchema",
        tags: ["portalPages"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.Integer({ description: "模板ID", minimum: 1 }) }),
        body: { $ref: "updateTemplateSchemaReq#" },
        response: { 200: { $ref: "templateSchemaResp#" } },
      },
    },
    async (request: FastifyRequest<{ Params: { id: number }; Body: { schema: any[] } }>, reply: FastifyReply) => {
      const schema = await TemplateService.updateTemplateSchema(request.params.id, request.body.schema, request.currentUser.id);
      const message = getPageMessage(PageMessageKeys.TEMPLATE_SCHEMA_UPDATE_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, schema, message);
    }
  );
};

export default adminPages;
