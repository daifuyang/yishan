import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { Type } from "@sinclair/typebox";
import { ResponseUtil } from '../../../../utils/response.js';
import { ShopCategoryModel, type CategoryListQuery } from '../../../../models/shop-category.model.js';
import { ShopMessageKeys, getShopMessage } from '../../../../constants/messages/shop.js';

const categoryListQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer()),
  pageSize: Type.Optional(Type.Integer()),
  keyword: Type.Optional(Type.String()),
  parentId: Type.Optional(Type.Integer()),
  status: Type.Optional(Type.String()),
  sortBy: Type.Optional(Type.Union([Type.Literal("sortOrder"), Type.Literal("createdAt")])),
  sortOrder: Type.Optional(Type.Union([Type.Literal("asc"), Type.Literal("desc")])),
});

const createCategorySchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 100 }),
  parentId: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
  coverImage: Type.Optional(Type.String()),
  icon: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  sortOrder: Type.Optional(Type.Integer()),
  status: Type.Optional(Type.Integer()),
});

const updateCategorySchema = Type.Object({
  name: Type.Optional(Type.String()),
  parentId: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
  coverImage: Type.Optional(Type.String()),
  icon: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  sortOrder: Type.Optional(Type.Integer()),
  status: Type.Optional(Type.Integer()),
});

const categories: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.get(
    "/",
    {
      schema: {
        summary: "获取分类列表",
        tags: ["shopCategories"],
        security: [{ bearerAuth: [] }],
        querystring: categoryListQuerySchema,
      },
    },
    async (request: FastifyRequest<{ Querystring: CategoryListQuery }>, reply: FastifyReply) => {
      const list = await ShopCategoryModel.getCategoryList(request.query);
      const message = getShopMessage(ShopMessageKeys.CATEGORY_LIST_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, list, message);
    }
  );

  fastify.get(
    "/tree",
    {
      schema: {
        summary: "获取分类树",
        tags: ["shopCategories"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tree = await ShopCategoryModel.getCategoryTree();
      const message = getShopMessage(ShopMessageKeys.CATEGORY_TREE_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, tree, message);
    }
  );

  fastify.get(
    "/:id",
    {
      schema: {
        summary: "获取分类详情",
        tags: ["shopCategories"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.Integer() }),
      },
    },
    async (request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) => {
      const category = await ShopCategoryModel.getCategoryById(request.params.id);
      if (!category) {
        return ResponseUtil.error(reply, "分类不存在");
      }
      const message = getShopMessage(ShopMessageKeys.CATEGORY_DETAIL_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, category, message);
    }
  );

  fastify.post(
    "/",
    {
      schema: {
        summary: "创建分类",
        tags: ["shopCategories"],
        security: [{ bearerAuth: [] }],
        body: createCategorySchema,
      },
    },
    async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
      const category = await ShopCategoryModel.createCategory(request.body as any, request.currentUser.id);
      const message = getShopMessage(ShopMessageKeys.CREATE_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, category, message);
    }
  );

  fastify.put(
    "/:id",
    {
      schema: {
        summary: "更新分类",
        tags: ["shopCategories"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.Integer() }),
        body: updateCategorySchema,
      },
    },
    async (request: FastifyRequest<{ Params: { id: number }; Body: any }>, reply: FastifyReply) => {
      const category = await ShopCategoryModel.updateCategory(request.params.id, request.body as any, request.currentUser.id);
      const message = getShopMessage(ShopMessageKeys.UPDATE_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, category, message);
    }
  );

  fastify.delete(
    "/:id",
    {
      schema: {
        summary: "删除分类",
        tags: ["shopCategories"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.Integer() }),
      },
    },
    async (request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) => {
      await ShopCategoryModel.deleteCategory(request.params.id);
      const message = getShopMessage(ShopMessageKeys.DELETE_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, { id: request.params.id }, message);
    }
  );
};

export default categories;
