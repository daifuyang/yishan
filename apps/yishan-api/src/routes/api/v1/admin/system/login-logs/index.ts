import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { Type } from "@sinclair/typebox";
import { ResponseUtil } from "../../../../../../utils/response.js";
import { LoginLogService } from "../../../../../../services/login-log.service.js";
import { SysLoginLogListQuery } from "../../../../../../schemas/login-log.js";
import { getSystemMessage, SystemMessageKeys } from "../../../../../../constants/messages/system.js";

const sysLoginLog: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.get(
    "/",
    {
      schema: {
        summary: "获取登录日志列表",
        description: "分页获取系统登录日志列表，支持关键词搜索与状态筛选",
        operationId: "getLoginLogList",
        tags: ["sysLoginLogs"],
        security: [{ bearerAuth: [] }],
        querystring: { $ref: "sysLoginLogListQuery#" },
        response: {
          200: { $ref: "sysLoginLogListResp#" },
        },
      },
    },
    async (
      request: FastifyRequest<{ Querystring: SysLoginLogListQuery }>,
      reply: FastifyReply
    ) => {
      const { page, pageSize } = request.query;
      const result = await LoginLogService.getLoginLogList(request.query);
      const message = getSystemMessage(SystemMessageKeys.LOGIN_LOG_LIST_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.paginated(reply, result.list, page, pageSize, result.total, message);
    }
  );

  fastify.get(
    "/:id",
    {
      schema: {
        summary: "获取登录日志详情",
        description: "根据日志ID获取登录日志详情",
        operationId: "getLoginLogDetail",
        tags: ["sysLoginLogs"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({
          id: Type.Integer({ description: "日志ID", minimum: 1 }),
        }),
        response: {
          200: { $ref: "sysLoginLogDetailResp#" },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: number } }>,
      reply: FastifyReply
    ) => {
      const item = await LoginLogService.getLoginLogById(request.params.id);
      const message = getSystemMessage(SystemMessageKeys.LOGIN_LOG_DETAIL_SUCCESS, request.headers["accept-language"] as string);
      return ResponseUtil.success(reply, item, message);
    }
  );
};

export default sysLoginLog;

