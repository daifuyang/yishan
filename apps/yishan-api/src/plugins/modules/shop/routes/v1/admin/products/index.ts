import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { Type } from "@sinclair/typebox";
import { ResponseUtil } from '../../../../utils/response.js';
import { ShopProductModel, type ProductListQuery } from '../../../../models/shop-product.model.js';
import { ShopMessageKeys, getShopMessage } from '../../../../constants/messages/shop.js';

const products: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.get(
    "/",
    {
      schema: {
        summary: "获取商品列表",
        description: "分页获取商品列表，支持关键词、分类、状态等筛选",
        operationId: "getProductList",
        tags: ["shopProducts"],
        security: [{ bearerAuth: [] }],
        querystring: { $ref: "shopProductListQuery#" },
        response: { 200: { $ref: "shopProductListResp#" } },
      },
    },
    async (request: FastifyRequest<{ Querystring: ProductListQuery }>, reply: FastifyReply) => {
      const { page = 1, pageSize = 10 } = request.query;
      const result = await ShopProductModel.getProductList(request.query);
      const message = getShopMessage(ShopMessageKeys.PRODUCT_LIST_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.paginated(reply, result.list, page, pageSize, result.total, message);
    }
  );

  fastify.get(
    "/:id",
    {
      schema: {
        summary: "获取商品详情",
        description: "根据商品ID获取商品详情，包含SKU信息",
        operationId: "getProductDetail",
        tags: ["shopProducts"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.Integer({ description: "商品ID", minimum: 1 }) }),
        response: { 200: { $ref: "shopProductDetailResp#" } },
      },
    },
    async (request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) => {
      const product = await ShopProductModel.getProductById(request.params.id);
      if (!product) {
        return ResponseUtil.error(reply, "商品不存在");
      }
      const message = getShopMessage(ShopMessageKeys.PRODUCT_DETAIL_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, product, message);
    }
  );

  fastify.post(
    "/",
    {
      schema: {
        summary: "创建商品",
        description: "创建新商品，支持多SKU",
        operationId: "createProduct",
        tags: ["shopProducts"],
        security: [{ bearerAuth: [] }],
        body: { $ref: "shopCreateProductReq#" },
        response: { 200: { $ref: "shopProductDetailResp#" } },
      },
    },
    async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
      const product = await ShopProductModel.createProduct(request.body, request.currentUser.id);
      const message = getShopMessage(ShopMessageKeys.PRODUCT_CREATE_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, product, message);
    }
  );

  fastify.put(
    "/:id",
    {
      schema: {
        summary: "更新商品",
        description: "根据商品ID更新商品信息",
        operationId: "updateProduct",
        tags: ["shopProducts"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.Integer({ description: "商品ID", minimum: 1 }) }),
        body: { $ref: "shopUpdateProductReq#" },
        response: { 200: { $ref: "shopProductDetailResp#" } },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: number }; Body: any }>,
      reply: FastifyReply
    ) => {
      const product = await ShopProductModel.updateProduct(request.params.id, request.body, request.currentUser.id);
      const message = getShopMessage(ShopMessageKeys.PRODUCT_UPDATE_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, product, message);
    }
  );

  fastify.put(
    "/:id/recycle",
    {
      schema: {
        summary: "移到回收站",
        description: "将商品移至回收站",
        operationId: "moveProductToRecycle",
        tags: ["shopProducts"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.Integer({ minimum: 1 }) }),
        response: { 200: { $ref: "shopIdResp#" } },
      },
    },
    async (request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) => {
      await ShopProductModel.moveToRecycle(request.params.id, request.currentUser.id);
      const message = getShopMessage(ShopMessageKeys.PRODUCT_DELETE_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, { id: request.params.id }, message);
    }
  );

  fastify.put(
    "/:id/restore",
    {
      schema: {
        summary: "从回收站恢复",
        description: "将商品从回收站恢复",
        operationId: "restoreProductFromRecycle",
        tags: ["shopProducts"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.Integer({ minimum: 1 }) }),
        response: { 200: { $ref: "shopIdResp#" } },
      },
    },
    async (request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) => {
      await ShopProductModel.restoreFromRecycle(request.params.id, request.currentUser.id);
      const message = getShopMessage(ShopMessageKeys.PRODUCT_RESTORE_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, { id: request.params.id }, message);
    }
  );

  fastify.delete(
    "/:id",
    {
      schema: {
        summary: "删除商品",
        description: "根据商品ID永久删除商品",
        operationId: "deleteProduct",
        tags: ["shopProducts"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.Integer({ minimum: 1 }) }),
        response: { 200: { $ref: "shopIdResp#" } },
      },
    },
    async (request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) => {
      await ShopProductModel.deleteProduct(request.params.id);
      const message = getShopMessage(ShopMessageKeys.PRODUCT_DELETE_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, { id: request.params.id }, message);
    }
  );
};

export default products;
