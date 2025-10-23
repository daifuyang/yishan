import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { ResponseUtil } from '../../../../utils/response.js';

export default async function adminIndexRoutes(fastify: FastifyInstance) {
  // GET /api/v1/admin - 管理员首页
  fastify.get(
    "/",
    {
      schema: {
        summary: "管理员首页",
        description: "管理员控制台首页",
        operationId: "getAdminHome",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              code: { type: "number", example: 10000 },
              message: { type: "string", example: "访问成功" },
              success: { type: "boolean", example: true },
              data: {
                type: "object",
                properties: {
                  message: { type: "string", example: "hello admin" },
                },
              },
              timestamp: { type: "string", example: "2024-01-01T00:00:00.000Z" },
              request_id: { type: "string", example: "uuid-string" }
            },
          },
          401: { $ref: 'unauthorizedResponse#' },
          403: { $ref: 'forbiddenResponse#' },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return ResponseUtil.success(reply, request, { message: "hello admin" }, "访问成功");
    }
  );
}
