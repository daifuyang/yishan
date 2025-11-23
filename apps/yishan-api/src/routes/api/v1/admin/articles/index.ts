import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { Type } from "@sinclair/typebox";
import { ResponseUtil } from "../../../../../utils/response.js";
import { ArticleService, CategoryService } from "../../../../../services/article.service.js";
import { getArticleMessage, ArticleMessageKeys } from "../../../../../constants/messages/article.js";
import { ArticleListQuery, CreateArticleReq, UpdateArticleReq, CategoryListQuery, SaveCategoryReq, UpdateCategoryReq } from "../../../../../schemas/article.js";

const adminArticles: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.get(
    "/",
    {
      schema: {
        summary: "获取文章列表",
        description: "分页获取门户文章列表，支持关键词、状态和分类过滤",
        operationId: "getArticleList",
        tags: ["portalArticles"],
        security: [{ bearerAuth: [] }],
        querystring: { $ref: "articleListQuery#" },
        response: { 200: { $ref: "articleListResp#" } },
      },
    },
    async (request: FastifyRequest<{ Querystring: ArticleListQuery }>, reply: FastifyReply) => {
      const { page, pageSize } = request.query;
      const result = await ArticleService.getArticleList(request.query);
      const message = getArticleMessage(ArticleMessageKeys.LIST_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.paginated(reply, result.list, page || 1, pageSize || 10, result.total, message);
    }
  );

  fastify.get(
    "/:id",
    {
      schema: {
        summary: "获取文章详情",
        description: "根据文章ID获取文章详情",
        operationId: "getArticleDetail",
        tags: ["portalArticles"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.Integer({ description: "文章ID", minimum: 1 }) }),
        response: { 200: { $ref: "articleDetailResp#" } },
      },
    },
    async (request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) => {
      const article = await ArticleService.getArticleById(request.params.id);
      const message = getArticleMessage(ArticleMessageKeys.DETAIL_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, article, message);
    }
  );

  fastify.post(
    "/",
    {
      schema: {
        summary: "创建文章",
        description: "创建一个新的门户文章，支持分类与自定义属性",
        operationId: "createArticle",
        tags: ["portalArticles"],
        security: [{ bearerAuth: [] }],
        body: { $ref: "createArticleReq#" },
        response: { 200: { $ref: "articleDetailResp#" } },
      },
    },
    async (request: FastifyRequest<{ Body: CreateArticleReq }>, reply: FastifyReply) => {
      const article = await ArticleService.createArticle(request.body, request.currentUser.id);
      const message = getArticleMessage(ArticleMessageKeys.CREATE_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, article, message);
    }
  );

  fastify.put(
    "/:id",
    {
      schema: {
        summary: "更新文章",
        description: "根据文章ID更新文章信息",
        operationId: "updateArticle",
        tags: ["portalArticles"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.Integer({ description: "文章ID", minimum: 1 }) }),
        body: { $ref: "updateArticleReq#" },
        response: { 200: { $ref: "articleDetailResp#" } },
      },
    },
    async (request: FastifyRequest<{ Params: { id: number }; Body: UpdateArticleReq }>, reply: FastifyReply) => {
      const article = await ArticleService.updateArticle(request.params.id, request.body, request.currentUser.id);
      const message = getArticleMessage(ArticleMessageKeys.UPDATE_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, article, message);
    }
  );

  fastify.delete(
    "/:id",
    {
      schema: {
        summary: "删除文章",
        description: "根据文章ID进行软删除",
        operationId: "deleteArticle",
        tags: ["portalArticles"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.Integer({ description: "文章ID", minimum: 1 }) }),
        response: { 200: { $ref: "articleDeleteResp#" } },
      },
    },
    async (request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) => {
      const result = await ArticleService.deleteArticle(request.params.id);
      const message = getArticleMessage(ArticleMessageKeys.DELETE_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, result, message);
    }
  );

  fastify.post(
    "/:id/publish",
    {
      schema: {
        summary: "发布文章",
        description: "将文章状态改为已发布并设置发布时间",
        operationId: "publishArticle",
        tags: ["portalArticles"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.Integer({ description: "文章ID", minimum: 1 }) }),
        response: { 200: { $ref: "articleDetailResp#" } },
      },
    },
    async (request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) => {
      const article = await ArticleService.publishArticle(request.params.id, request.currentUser.id);
      const message = getArticleMessage(ArticleMessageKeys.PUBLISH_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, article, message);
    }
  );

  fastify.get(
    "/categories",
    {
      schema: {
        summary: "获取分类列表",
        description: "分页获取文章分类列表，支持关键词、状态和父级过滤",
        operationId: "getCategoryList",
        tags: ["portalCategories"],
        security: [{ bearerAuth: [] }],
        querystring: { $ref: "categoryListQuery#" },
        response: { 200: { $ref: "categoryListResp#" } },
      },
    },
    async (request: FastifyRequest<{ Querystring: CategoryListQuery }>, reply: FastifyReply) => {
      const { page, pageSize } = request.query;
      const result = await CategoryService.getCategoryList(request.query);
      const message = getArticleMessage(ArticleMessageKeys.CATEGORY_LIST_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.paginated(reply, result.list, page || 1, pageSize || 10, result.total, message);
    }
  );

  fastify.get(
    "/categories/:id",
    {
      schema: {
        summary: "获取分类详情",
        description: "根据分类ID获取分类详情",
        operationId: "getCategoryDetail",
        tags: ["portalCategories"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.Integer({ description: "分类ID", minimum: 1 }) }),
        response: { 200: { $ref: "categoryDetailResp#" } },
      },
    },
    async (request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) => {
      const category = await CategoryService.getCategoryById(request.params.id);
      const message = getArticleMessage(ArticleMessageKeys.CATEGORY_DETAIL_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, category, message);
    }
  );

  fastify.post(
    "/categories",
    {
      schema: {
        summary: "创建分类",
        description: "创建一个新的文章分类",
        operationId: "createCategory",
        tags: ["portalCategories"],
        security: [{ bearerAuth: [] }],
        body: { $ref: "saveCategoryReq#" },
        response: { 200: { $ref: "categoryDetailResp#" } },
      },
    },
    async (request: FastifyRequest<{ Body: SaveCategoryReq }>, reply: FastifyReply) => {
      const category = await CategoryService.createCategory(request.body, request.currentUser.id);
      const message = getArticleMessage(ArticleMessageKeys.CATEGORY_CREATE_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, category, message);
    }
  );

  fastify.put(
    "/categories/:id",
    {
      schema: {
        summary: "更新分类",
        description: "根据分类ID更新分类信息",
        operationId: "updateCategory",
        tags: ["portalCategories"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.Integer({ description: "分类ID", minimum: 1 }) }),
        body: { $ref: "updateCategoryReq#" },
        response: { 200: { $ref: "categoryDetailResp#" } },
      },
    },
    async (request: FastifyRequest<{ Params: { id: number }; Body: UpdateCategoryReq }>, reply: FastifyReply) => {
      const category = await CategoryService.updateCategory(request.params.id, request.body, request.currentUser.id);
      const message = getArticleMessage(ArticleMessageKeys.CATEGORY_UPDATE_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, category, message);
    }
  );

  fastify.delete(
    "/categories/:id",
    {
      schema: {
        summary: "删除分类",
        description: "根据分类ID进行软删除",
        operationId: "deleteCategory",
        tags: ["portalCategories"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.Integer({ description: "分类ID", minimum: 1 }) }),
        response: { 200: { $ref: "categoryDeleteResp#" } },
      },
    },
    async (request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) => {
      const result = await CategoryService.deleteCategory(request.params.id);
      const message = getArticleMessage(ArticleMessageKeys.CATEGORY_DELETE_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, result, message);
    }
  );
};

export default adminArticles;
