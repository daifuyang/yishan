import { createRouteRegistrar } from '../../../../route-registrar.js';
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { Type } from "@sinclair/typebox";
import { ResponseUtil } from "../../../../../../utils/response.js";
import { BusinessError } from "../../../../../../exceptions/business-error.js";
import { UserErrorCode } from "../../../../../../constants/business-codes/user.js";
import { UserService } from "../../../../../services/user.service.js";
import { LoginLogService } from "../../../../../services/login-log.service.js";
import { registerPermissions, type PermissionRef } from '../../../../../permissions/catalog.js';

const PERMS: { readonly [k: string]: PermissionRef } = Object.freeze({
  UPDATE_ME:        { code: 'app:user:update-me', label: '移动端-更新自己', group: 'app' },
  CHANGE_MY_PWD:    { code: 'app:user:change-pwd', label: '移动端-改自己密码', group: 'app' },
  LIST_MY_LOGINS:   { code: 'app:user:my-logins',  label: '移动端-自己登录日志', group: 'app' },
});
registerPermissions(...Object.values(PERMS));

/**
 * 移动端个人路由 - /api/v1/app/users
 *
 * 仅做参数提取 + Service 调用 + ResponseUtil 封装。
 * 所有数据访问与业务校验下沉到 Service（UserService / LoginLogService）。
 */
const users: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  const route = createRouteRegistrar(fastify);
  // PUT /api/v1/app/users/me - 更新个人资料
  route.put(
    "/me",
    {
      access: { permission: PERMS.UPDATE_ME },
      schema: {
        summary: "更新当前用户资料",
        description: "移动端更新当前登录用户的昵称/真实姓名/邮箱/性别/出生日期/手机号/头像等可编辑字段",
        operationId: "appUpdateMe",
        tags: ["app-users"],
        security: [{ bearerAuth: [] }],
        body: Type.Object({
          nickname: Type.Optional(Type.String({ maxLength: 50 })),
          realName: Type.Optional(Type.String({ maxLength: 50 })),
          email: Type.Optional(Type.String({ format: "email" })),
          gender: Type.Optional(Type.String({ enum: ["0", "1", "2"] })),
          birthDate: Type.Optional(Type.String({ format: "date" })),
          phone: Type.Optional(Type.String({ pattern: "^1[3-9]\\d{9}$" })),
          avatar: Type.Optional(Type.String({ maxLength: 500 })),
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
        fastify,
      );
      if (!updated) {
        throw new BusinessError(UserErrorCode.USER_NOT_FOUND, "用户不存在");
      }
      return ResponseUtil.success(reply, updated, "更新成功");
    },
  );

  // PUT /api/v1/app/users/me/password - 修改自己密码
  route.put(
    "/me/password",
    {
      access: { permission: PERMS.CHANGE_MY_PWD },
      schema: {
        summary: "修改当前用户密码",
        description: "需要传入旧密码与新密码，旧密码校验通过后写入新密码并撤销所有 token",
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

      await UserService.changePassword(userId, oldPassword, newPassword, fastify);

      return ResponseUtil.success(reply, null, "密码修改成功，请重新登录");
    },
  );

  // GET /api/v1/app/users/me/login-logs - 我的登录日志
  route.get(
    "/me/login-logs",
    {
      access: { permission: PERMS.LIST_MY_LOGINS },
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
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.currentUser.id;
      const { page = 1, pageSize = 10 } = request.query as {
        page?: number;
        pageSize?: number;
      };
      const result = await LoginLogService.getMyLoginLogs(userId, { page, pageSize });
      return ResponseUtil.paginated(
        reply,
        result.list,
        result.page,
        result.pageSize,
        result.total,
        "获取成功",
      );
    },
  );
};

export default users;
