import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { Type } from "@sinclair/typebox";
import { ResponseUtil } from "../../../../../../utils/response.js";
import { prisma } from "../../../../../../utils/prisma.js";
import { DeptService } from "../../../../../services/dept.service.js";

/**
 * 移动端通讯录路由 - /api/v1/app/contacts
 * 复用 DeptService.getDeptTree；部门成员直接用 prisma 拉取
 */
const contacts: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  // GET /api/v1/app/contacts/depts/tree - 部门树
  fastify.get(
    "/depts/tree",
    {
      preHandler: fastify.authenticate,
      schema: {
        summary: "获取部门树（移动端）",
        description: "返回全部部门树形结构，供移动端通讯录展示",
        operationId: "appGetDeptTree",
        tags: ["app-contacts"],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              code: { type: "number" },
              message: { type: "string" },
              data: { type: "array", items: { type: "object", additionalProperties: true } },
              timestamp: { type: "string" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tree = await DeptService.getDeptTree();
      return ResponseUtil.success(reply, tree, "获取部门树成功");
    }
  );

  // GET /api/v1/app/contacts/depts/:id/users - 部门成员
  fastify.get(
    "/depts/:id/users",
    {
      preHandler: fastify.authenticate,
      schema: {
        summary: "获取部门成员（移动端）",
        description: "根据部门ID返回该部门下的所有启用用户",
        operationId: "appGetDeptUsers",
        tags: ["app-contacts"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.Integer({ minimum: 1 }) }),
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              code: { type: "number" },
              message: { type: "string" },
              data: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "number" },
                    realName: { type: "string" },
                    username: { type: "string" },
                    phone: { type: "string" },
                    email: { type: "string" },
                    avatar: { type: "string" },
                    gender: { type: "string" },
                    genderName: { type: "string" },
                  },
                },
              },
              timestamp: { type: "string" },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      const deptId = (request.params as { id: number }).id;
      const users = await prisma.sysUser.findMany({
        where: {
          deletedAt: null,
          status: 1,
          userDepts: { some: { deptId, deletedAt: null } },
        },
        select: {
          id: true,
          username: true,
          realName: true,
          phone: true,
          email: true,
          avatar: true,
          gender: true,
        },
        orderBy: { id: "asc" },
      });

      const data = users.map((u) => ({
        id: u.id,
        username: u.username,
        realName: u.realName ?? "",
        phone: u.phone,
        email: u.email ?? "",
        avatar: u.avatar ?? "",
        gender: u.gender.toString(),
        genderName: u.gender === 1 ? "男" : u.gender === 2 ? "女" : "未知",
      }));

      return ResponseUtil.success(reply, data, "获取部门成员成功");
    }
  );
};

export default contacts;
