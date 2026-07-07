import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { Type } from "@sinclair/typebox";
import { ResponseUtil } from "../../../../../../utils/response.js";
import { BusinessError } from "../../../../../../exceptions/business-error.js";
import { UserErrorCode } from "../../../../../../constants/business-codes/user.js";
import { UserService } from "../../../../../services/user.service.js";
import { comparePassword } from "../../../../../../utils/password.js";
import { prisma } from "../../../../../../utils/prisma.js";

/**
 * 移动端个人路由 - /api/v1/app/users
 */
const users: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  // PUT /api/v1/app/users/me - 更新个人资料
  fastify.put(
    "/me",
    {
      preHandler: fastify.authenticate,
      schema: {
        summary: "更新当前用户资料",
        description: "移动端更新当前登录用户的昵称/性别/邮箱/头像等可编辑字段",
        operationId: "appUpdateMe",
        tags: ["app-users"],
        security: [{ bearerAuth: [] }],
        body: Type.Object({
          nickname: Type.Optional(Type.String({ maxLength: 50 })),
          realName: Type.Optional(Type.String({ maxLength: 50 })),
          email: Type.Optional(Type.String({ format: "email" })),
          gender: Type.Optional(Type.String({ enum: ["0", "1", "2"] })),
          birthDate: Type.Optional(Type.String({ format: "date" })),
        }),
        response: { 200: { $ref: "userDetailResp#" } },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.currentUser.id;
      const updated = await UserService.updateUser(
        userId,
        request.body as any,
        userId,
        fastify
      );
      if (!updated) {
        throw new BusinessError(UserErrorCode.USER_NOT_FOUND, "用户不存在");
      }
      return ResponseUtil.success(reply, updated, "更新成功");
    }
  );

  // PUT /api/v1/app/users/me/password - 修改自己密码
  fastify.put(
    "/me/password",
    {
      preHandler: fastify.authenticate,
      schema: {
        summary: "修改当前用户密码",
        description: "需要传入旧密码与新密码，旧密码校验通过后写入新密码",
        operationId: "appChangeMyPassword",
        tags: ["app-users"],
        security: [{ bearerAuth: [] }],
        body: Type.Object({
          oldPassword: Type.String({ minLength: 6, maxLength: 50 }),
          newPassword: Type.String({
            minLength: 6,
            maxLength: 50,
            pattern: "^(?=.*[a-zA-Z])(?=.*\\d)[a-zA-Z\\d@$!%*?&]{6,}$",
          }),
        }),
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              code: { type: "number" },
              message: { type: "string" },
              timestamp: { type: "string" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.currentUser.id;
      const { oldPassword, newPassword } = request.body as {
        oldPassword: string;
        newPassword: string;
      };

      // 读取带 passwordHash 的原始用户
      const raw = await prisma.sysUser.findFirst({
        where: { id: userId, deletedAt: null },
      });
      if (!raw) {
        throw new BusinessError(UserErrorCode.USER_NOT_FOUND, "用户不存在");
      }
      const ok = await comparePassword(oldPassword, raw.passwordHash);
      if (!ok) {
        throw new BusinessError(UserErrorCode.PASSWORD_ERROR, "旧密码错误");
      }

      // 复用 UserService.updateUser 写入新密码（包含强度校验 + 缓存刷新）
      await UserService.updateUser(
        userId,
        { password: newPassword } as any,
        userId,
        fastify
      );

      // 撤销该用户的所有 token，强制重新登录
      const { SysUserTokenModel } = await import(
        "../../../../../models/sys-user-token.model.js"
      );
      const tokens = await SysUserTokenModel.findActiveTokensByUserId(userId);
      for (const t of tokens) {
        await SysUserTokenModel.revoke(t.id);
      }

      return ResponseUtil.success(reply, null, "密码修改成功，请重新登录");
    }
  );

  // GET /api/v1/app/users/me/login-logs - 我的登录日志
  fastify.get(
    "/me/login-logs",
    {
      preHandler: fastify.authenticate,
      schema: {
        summary: "我的登录日志",
        description: "分页获取当前用户的登录日志",
        operationId: "appGetMyLoginLogs",
        tags: ["app-users"],
        security: [{ bearerAuth: [] }],
        querystring: Type.Object({
          page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
          pageSize: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 10 })),
        }),
        response: { 200: { $ref: "sysLoginLogListResp#" } },
      },
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      const userId = request.currentUser.id;
      const { page = 1, pageSize = 10 } = request.query as {
        page?: number;
        pageSize?: number;
      };
      // 直接用 prisma 查询（按 userId 过滤）
      const [rows, total] = await Promise.all([
        prisma.sysLoginLog.findMany({
          where: { deletedAt: null, userId },
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.sysLoginLog.count({
          where: { deletedAt: null, userId },
        }),
      ]);
      const list = rows.map((item) => ({
        id: item.id,
        userId: item.userId ?? undefined,
        username: item.username,
        realName: item.realName ?? undefined,
        status: item.status.toString(),
        message: item.message ?? undefined,
        ipAddress: item.ipAddress ?? undefined,
        userAgent: item.userAgent ?? undefined,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      }));
      return ResponseUtil.paginated(reply, list, page, pageSize, total, "获取成功");
    }
  );
};

export default users;
