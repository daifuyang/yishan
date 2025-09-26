import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

export default async function adminIndexRoutes(fastify: FastifyInstance) {
  // 添加管理员权限验证钩子
  fastify.addHook(
    "preHandler",
    async (request: FastifyRequest, reply: FastifyReply) => {
      // TODO: 实现管理员权限验证逻辑
      // 这里暂时跳过验证，后续可以添加 fastify.requireAdmin 或类似验证
    }
  );

  // GET /api/v1/admin - 管理员首页
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Admin"],
        summary: "管理员首页",
        description: "管理员控制台首页",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              code: { type: "number", example: 200 },
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
              code: { type: "number", example: 401 },
              message: { type: "string", example: "未授权访问" },
            },
          },
          403: {
            type: "object",
            properties: {
              code: { type: "number", example: 403 },
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
