import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { Type } from "@sinclair/typebox";
import { ResponseUtil } from "../../../../../../utils/response.js";
import { ValidationErrorCode } from "../../../../../../constants/business-codes/validation.js";
import { PositionErrorCode } from "../../../../../../constants/business-codes/position.js";
import { BusinessError } from "../../../../../../exceptions/business-error.js";
import { PositionListQuery, SavePositionReq, UpdatePositionReq } from "../../../../../schemas/position.js";
import { PositionService } from "../../../../../services/position.service.js";
import { getPositionMessage, PositionMessageKeys } from "../../../../../../constants/messages/position.js";
import { corePermissions } from '../../../../../permissions/core-permissions.js';

const adminPositions: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.get(
    "/",
    {
      preHandler: [fastify.requirePermission(corePermissions.SYSTEM_POSITION_LIST)] as any,
      schema: {
        summary: "获取岗位列表",
        description: "分页获取系统岗位列表，支持关键词搜索和状态筛选",
        operationId: "getPositionList",
        tags: ["sysPositions"],
        security: [{ bearerAuth: [] }],
        querystring: { $ref: "positionListQuery#" },
        response: {
          200: { $ref: "positionListResp#" },
        },
      },
    },
    async (
      request: FastifyRequest<{ Querystring: PositionListQuery }>,
      reply: FastifyReply
    ) => {
      const { page, pageSize } = request.query;
      const result = await PositionService.getPositionList(request.query);
      const message = getPositionMessage(PositionMessageKeys.LIST_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.paginated(
        reply,
        result.list,
        page,
        pageSize,
        result.total,
        message
      );
    }
  );

  fastify.get(
    "/:id",
    {
      preHandler: [fastify.requirePermission(corePermissions.SYSTEM_POSITION_LIST)] as any,
      schema: {
        summary: "获取岗位详情",
        description: "根据岗位ID获取岗位详情",
        operationId: "getPositionDetail",
        tags: ["sysPositions"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.String({ description: "岗位ID" }) }),
        response: { 200: { $ref: "positionDetailResp#" } },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const positionId = parseInt(request.params.id);
      if (isNaN(positionId)) {
        throw new BusinessError(ValidationErrorCode.INVALID_PARAMETER, "岗位ID不能为空");
      }
      const position = await PositionService.getPositionById(positionId);
      if (!position) {
        throw new BusinessError(PositionErrorCode.POSITION_NOT_FOUND, "岗位不存在");
      }
      {
        const message = getPositionMessage(PositionMessageKeys.DETAIL_SUCCESS, request.headers["accept-language"] as string);
        return ResponseUtil.success(reply, position, message);
      }
    }
  );

  fastify.post(
    "/",
    {
      preHandler: [fastify.requirePermission(corePermissions.SYSTEM_POSITION_CREATE)] as any,
      schema: {
        summary: "创建岗位",
        description: "创建一个新的岗位",
        operationId: "createPosition",
        tags: ["sysPositions"],
        security: [{ bearerAuth: [] }],
        body: { $ref: "savePositionReq#" },
        response: { 200: { $ref: "positionDetailResp#" } },
      },
    },
    async (
      request: FastifyRequest<{ Body: SavePositionReq }>,
      reply: FastifyReply
    ) => {
      const position = await PositionService.createPosition(request.body);
      {
        const message = getPositionMessage(PositionMessageKeys.CREATE_SUCCESS, request.headers["accept-language"] as string);
        return ResponseUtil.success(reply, position, message);
      }
    }
  );

  fastify.put(
    "/:id",
    {
      preHandler: [fastify.requirePermission(corePermissions.SYSTEM_POSITION_UPDATE)] as any,
      schema: {
        summary: "更新岗位",
        description: "根据岗位ID更新岗位信息",
        operationId: "updatePosition",
        tags: ["sysPositions"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.String({ description: "岗位ID" }) }),
        body: { $ref: "updatePositionReq#" },
        response: { 200: { $ref: "positionDetailResp#" } },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: UpdatePositionReq }>,
      reply: FastifyReply
    ) => {
      const positionId = parseInt(request.params.id);
      if (isNaN(positionId)) {
        throw new BusinessError(ValidationErrorCode.INVALID_PARAMETER, "岗位ID不能为空");
      }
      const position = await PositionService.updatePosition(positionId, request.body);
      {
        const message = getPositionMessage(PositionMessageKeys.UPDATE_SUCCESS, request.headers["accept-language"] as string);
        return ResponseUtil.success(reply, position, message);
      }
    }
  );

  fastify.delete(
    "/:id",
    {
      preHandler: [fastify.requirePermission(corePermissions.SYSTEM_POSITION_DELETE)] as any,
      schema: {
        summary: "删除岗位",
        description: "根据岗位ID进行软删除",
        operationId: "deletePosition",
        tags: ["sysPositions"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.String({ description: "岗位ID" }) }),
        response: { 200: { $ref: "positionDeleteResp#" } },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const positionId = parseInt(request.params.id);
      if (isNaN(positionId)) {
        throw new BusinessError(ValidationErrorCode.INVALID_PARAMETER, "岗位ID不能为空");
      }
      const result = await PositionService.deletePosition(positionId);
      {
        const message = getPositionMessage(PositionMessageKeys.DELETE_SUCCESS, request.headers["accept-language"] as string);
        return ResponseUtil.success(reply, result, message);
      }
    }
  );
};

export default adminPositions;
