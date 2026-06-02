import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { Type } from "@sinclair/typebox";
import { ResponseUtil } from '../../../../utils/response.js';
import { ShopOrderModel, type OrderListQuery } from '../../../../models/shop-order.model.js';
import { ShopMessageKeys, getShopMessage } from '../../../../constants/messages/shop.js';

const orders: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.get(
    "/",
    {
      schema: {
        summary: "获取订单列表",
        description: "分页获取订单列表，支持关键词、状态等筛选",
        operationId: "getOrderList",
        tags: ["shopOrders"],
        security: [{ bearerAuth: [] }],
        querystring: { $ref: "shopOrderListQuery#" },
        response: { 200: { $ref: "shopOrderListResp#" } },
      },
    },
    async (request: FastifyRequest<{ Querystring: OrderListQuery }>, reply: FastifyReply) => {
      const { page = 1, pageSize = 10 } = request.query;
      const result = await ShopOrderModel.getOrderList(request.query);
      const message = getShopMessage(ShopMessageKeys.ORDER_LIST_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.paginated(reply, result.list, page, pageSize, result.total, message);
    }
  );

  fastify.get(
    "/:id",
    {
      schema: {
        summary: "获取订单详情",
        description: "根据订单ID获取订单详情",
        operationId: "getOrderDetail",
        tags: ["shopOrders"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.Integer({ description: "订单ID", minimum: 1 }) }),
        response: { 200: { $ref: "shopOrderDetailResp#" } },
      },
    },
    async (request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) => {
      const order = await ShopOrderModel.getOrderById(request.params.id);
      if (!order) {
        return ResponseUtil.error(reply, "订单不存在");
      }
      const message = getShopMessage(ShopMessageKeys.ORDER_DETAIL_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, order, message);
    }
  );

  fastify.put(
    "/:id/status",
    {
      schema: {
        summary: "更新订单状态",
        description: "更新订单状态",
        operationId: "updateOrderStatus",
        tags: ["shopOrders"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.Integer({ minimum: 1 }) }),
        body: { $ref: "shopUpdateOrderStatusReq#" },
        response: { 200: { $ref: "shopOrderDetailResp#" } },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: number }; Body: any }>,
      reply: FastifyReply
    ) => {
      const order = await ShopOrderModel.updateOrderStatus(request.params.id, request.body, request.currentUser.id);
      const message = getShopMessage(ShopMessageKeys.ORDER_STATUS_UPDATE_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, order, message);
    }
  );

  fastify.put(
    "/:id/deliver",
    {
      schema: {
        summary: "发货",
        description: "更新物流信息",
        operationId: "deliverOrder",
        tags: ["shopOrders"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.Integer({ minimum: 1 }) }),
        body: { $ref: "deliverOrderReq#" },
        response: { 200: { $ref: "shopOrderDetailResp#" } },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: number }; Body: any }>,
      reply: FastifyReply
    ) => {
      const order = await ShopOrderModel.deliverOrder(request.params.id, request.body, request.currentUser.id);
      const message = getShopMessage(ShopMessageKeys.ORDER_DELIVER_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, order, message);
    }
  );

  fastify.delete(
    "/:id",
    {
      schema: {
        summary: "删除订单",
        description: "根据订单ID软删除订单",
        operationId: "deleteOrder",
        tags: ["shopOrders"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.Integer({ minimum: 1 }) }),
        response: { 200: { $ref: "shopIdResp#" } },
      },
    },
    async (request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) => {
      await ShopOrderModel.deleteOrder(request.params.id);
      const message = getShopMessage(ShopMessageKeys.ORDER_DELETE_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, { id: request.params.id }, message);
    }
  );
};

export default orders;
