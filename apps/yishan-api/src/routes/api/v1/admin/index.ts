import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

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
              code: { type: "number", example: 20000 },
              message: { type: "string", example: "success" },
              data: {
                type: "object",
                properties: {
                  message: { type: "string", example: "hello admin" },
                },
              },
            },
          },
          401: {
            type: "object",
            properties: {
              code: { type: "number", example: 40003 },
              message: { type: "string", example: "未授权访问" },
            },
          },
          403: {
            type: "object",
            properties: {
              code: { type: "number", example: 40004 },
              message: { type: "string", example: "权限不足" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return reply.sendSuccess({ message: "hello admin" }, "访问成功");
    }
  );
}
