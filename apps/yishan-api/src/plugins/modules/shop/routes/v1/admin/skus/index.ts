import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { Type } from "@sinclair/typebox";
import { ResponseUtil } from '../../../../utils/response.js';
import { ShopSkuModel, type SkuListQuery } from '../../../../models/shop-sku.model.js';
import { ShopMessageKeys, getShopMessage } from '../../../../constants/messages/shop.js';

const skuListQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer()),
  pageSize: Type.Optional(Type.Integer()),
  productId: Type.Optional(Type.Integer()),
  keyword: Type.Optional(Type.String()),
  status: Type.Optional(Type.String()),
});

const createSkuSchema = Type.Object({
  productId: Type.Integer(),
  skuCode: Type.String(),
  skuName: Type.String(),
  price: Type.Number(),
  costPrice: Type.Optional(Type.Number()),
  stock: Type.Optional(Type.Integer()),
  weight: Type.Optional(Type.Number()),
  coverImage: Type.Optional(Type.String()),
  status: Type.Optional(Type.Integer()),
  attributes: Type.Optional(Type.Array(Type.Object({ attributeId: Type.Integer(), valueId: Type.Integer() }))),
});

const updateSkuSchema = Type.Object({
  skuCode: Type.Optional(Type.String()),
  skuName: Type.Optional(Type.String()),
  price: Type.Optional(Type.Number()),
  costPrice: Type.Optional(Type.Number()),
  stock: Type.Optional(Type.Integer()),
  weight: Type.Optional(Type.Number()),
  coverImage: Type.Optional(Type.String()),
  status: Type.Optional(Type.Integer()),
  attributes: Type.Optional(Type.Array(Type.Object({ attributeId: Type.Integer(), valueId: Type.Integer() }))),
});

const skus: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.get(
    "/",
    {
      schema: {
        summary: "获取SKU列表",
        tags: ["shopSkus"],
        security: [{ bearerAuth: [] }],
        querystring: skuListQuerySchema,
      },
    },
    async (request: FastifyRequest<{ Querystring: SkuListQuery }>, reply: FastifyReply) => {
      const { page = 1, pageSize = 10 } = request.query;
      const result = await ShopSkuModel.getSkuList(request.query);
      const message = getShopMessage(ShopMessageKeys.SKU_LIST_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.paginated(reply, result.list, page, pageSize, result.total, message);
    }
  );

  fastify.get(
    "/:id",
    {
      schema: {
        summary: "获取SKU详情",
        tags: ["shopSkus"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.Integer() }),
      },
    },
    async (request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) => {
      const sku = await ShopSkuModel.getSkuById(request.params.id);
      if (!sku) {
        return ResponseUtil.error(reply, "SKU不存在");
      }
      const message = getShopMessage(ShopMessageKeys.SKU_DETAIL_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, sku, message);
    }
  );

  fastify.post(
    "/",
    {
      schema: {
        summary: "创建SKU",
        tags: ["shopSkus"],
        security: [{ bearerAuth: [] }],
        body: createSkuSchema,
      },
    },
    async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
      const sku = await ShopSkuModel.createSku(request.body, request.currentUser.id);
      const message = getShopMessage(ShopMessageKeys.SKU_CREATE_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, sku, message);
    }
  );

  fastify.put(
    "/:id",
    {
      schema: {
        summary: "更新SKU",
        tags: ["shopSkus"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.Integer() }),
        body: updateSkuSchema,
      },
    },
    async (request: FastifyRequest<{ Params: { id: number }; Body: any }>, reply: FastifyReply) => {
      const sku = await ShopSkuModel.updateSku(request.params.id, request.body, request.currentUser.id);
      const message = getShopMessage(ShopMessageKeys.SKU_UPDATE_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, sku, message);
    }
  );

  fastify.delete(
    "/:id",
    {
      schema: {
        summary: "删除SKU",
        tags: ["shopSkus"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.Integer() }),
      },
    },
    async (request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) => {
      await ShopSkuModel.deleteSku(request.params.id, request.currentUser.id);
      const message = getShopMessage(ShopMessageKeys.SKU_DELETE_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, { id: request.params.id }, message);
    }
  );
};

export default skus;
