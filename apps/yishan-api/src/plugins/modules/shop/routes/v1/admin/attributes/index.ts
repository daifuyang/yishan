import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { Type } from "@sinclair/typebox";
import { ResponseUtil } from '../../../../utils/response.js';
import { ShopAttributeModel, type AttributeListQuery } from '../../../../models/shop-attribute.model.js';
import { ShopMessageKeys, getShopMessage } from '../../../../constants/messages/shop.js';

const attributeListQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer()),
  pageSize: Type.Optional(Type.Integer()),
  keyword: Type.Optional(Type.String()),
  type: Type.Optional(Type.Integer()),
  status: Type.Optional(Type.String()),
});

const createAttributeSchema = Type.Object({
  name: Type.String(),
  type: Type.Optional(Type.Integer()),
  sortOrder: Type.Optional(Type.Integer()),
  status: Type.Optional(Type.Integer()),
  values: Type.Optional(Type.Array(Type.Object({
    value: Type.String(),
    image: Type.Optional(Type.String()),
    sortOrder: Type.Optional(Type.Integer()),
  }))),
});

const updateAttributeSchema = Type.Object({
  name: Type.Optional(Type.String()),
  type: Type.Optional(Type.Integer()),
  sortOrder: Type.Optional(Type.Integer()),
  status: Type.Optional(Type.Integer()),
});

const createAttributeValueSchema = Type.Object({
  value: Type.String(),
  image: Type.Optional(Type.String()),
  sortOrder: Type.Optional(Type.Integer()),
});

const updateAttributeValueSchema = Type.Object({
  value: Type.Optional(Type.String()),
  image: Type.Optional(Type.String()),
  sortOrder: Type.Optional(Type.Integer()),
  status: Type.Optional(Type.Integer()),
});

const attributes: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.get(
    "/",
    {
      schema: {
        summary: "获取属性列表",
        tags: ["shopAttributes"],
        security: [{ bearerAuth: [] }],
        querystring: attributeListQuerySchema,
      },
    },
    async (request: FastifyRequest<{ Querystring: AttributeListQuery }>, reply: FastifyReply) => {
      const { page = 1, pageSize = 10 } = request.query;
      const result = await ShopAttributeModel.getAttributeList(request.query);
      const message = getShopMessage(ShopMessageKeys.ATTRIBUTE_LIST_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.paginated(reply, result.list, page, pageSize, result.total, message);
    }
  );

  fastify.get(
    "/specs",
    {
      schema: {
        summary: "获取规格属性列表",
        tags: ["shopAttributes"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const list = await ShopAttributeModel.getSpecAttributes();
      const message = getShopMessage(ShopMessageKeys.ATTRIBUTE_LIST_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, list, message);
    }
  );

  fastify.get(
    "/:id",
    {
      schema: {
        summary: "获取属性详情",
        tags: ["shopAttributes"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.Integer() }),
      },
    },
    async (request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) => {
      const attribute = await ShopAttributeModel.getAttributeById(request.params.id);
      if (!attribute) {
        return ResponseUtil.error(reply, "属性不存在");
      }
      const message = getShopMessage(ShopMessageKeys.ATTRIBUTE_DETAIL_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, attribute, message);
    }
  );

  fastify.post(
    "/",
    {
      schema: {
        summary: "创建属性",
        tags: ["shopAttributes"],
        security: [{ bearerAuth: [] }],
        body: createAttributeSchema,
      },
    },
    async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
      const attribute = await ShopAttributeModel.createAttribute(request.body, request.currentUser.id);
      const message = getShopMessage(ShopMessageKeys.ATTRIBUTE_CREATE_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, attribute, message);
    }
  );

  fastify.put(
    "/:id",
    {
      schema: {
        summary: "更新属性",
        tags: ["shopAttributes"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.Integer() }),
        body: updateAttributeSchema,
      },
    },
    async (request: FastifyRequest<{ Params: { id: number }; Body: any }>, reply: FastifyReply) => {
      const attribute = await ShopAttributeModel.updateAttribute(request.params.id, request.body, request.currentUser.id);
      const message = getShopMessage(ShopMessageKeys.ATTRIBUTE_UPDATE_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, attribute, message);
    }
  );

  fastify.delete(
    "/:id",
    {
      schema: {
        summary: "删除属性",
        tags: ["shopAttributes"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.Integer() }),
      },
    },
    async (request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) => {
      await ShopAttributeModel.deleteAttribute(request.params.id);
      const message = getShopMessage(ShopMessageKeys.ATTRIBUTE_DELETE_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, { id: request.params.id }, message);
    }
  );

  // 属性值管理
  fastify.post(
    "/:id/values",
    {
      schema: {
        summary: "创建属性值",
        tags: ["shopAttributes"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.Integer() }),
        body: createAttributeValueSchema,
      },
    },
    async (request: FastifyRequest<{ Params: { id: number }; Body: any }>, reply: FastifyReply) => {
      const value = await ShopAttributeModel.createAttributeValue(request.params.id, request.body, request.currentUser.id);
      const message = getShopMessage(ShopMessageKeys.ATTRIBUTE_VALUE_CREATE_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, value, message);
    }
  );

  fastify.put(
    "/values/:valueId",
    {
      schema: {
        summary: "更新属性值",
        tags: ["shopAttributes"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ valueId: Type.Integer() }),
        body: updateAttributeValueSchema,
      },
    },
    async (request: FastifyRequest<{ Params: { valueId: number }; Body: any }>, reply: FastifyReply) => {
      const value = await ShopAttributeModel.updateAttributeValue(request.params.valueId, request.body, request.currentUser.id);
      const message = getShopMessage(ShopMessageKeys.ATTRIBUTE_VALUE_UPDATE_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, value, message);
    }
  );

  fastify.delete(
    "/values/:valueId",
    {
      schema: {
        summary: "删除属性值",
        tags: ["shopAttributes"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ valueId: Type.Integer() }),
      },
    },
    async (request: FastifyRequest<{ Params: { valueId: number } }>, reply: FastifyReply) => {
      await ShopAttributeModel.deleteAttributeValue(request.params.valueId);
      const message = getShopMessage(ShopMessageKeys.ATTRIBUTE_VALUE_DELETE_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, { id: request.params.valueId }, message);
    }
  );
};

export default attributes;
