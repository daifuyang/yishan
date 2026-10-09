import { createRouteRegistrar } from '@yishan/core-api/routes/route-registrar';
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { ResponseUtil } from "@yishan/core-api/response";
import { BusinessError } from "@yishan/core-api/errors";
import { ValidationErrorCode } from "@yishan/core-api/business-codes/validation";
import { AuthErrorCode } from "@yishan/core-api/business-codes/auth";
import {
  LoginReq,
  RefreshTokenReq,
} from "../../../../../schemas/auth.js";
import { AuthService } from "../../../../../services/auth.service.js";
import { MenuService } from "../../../../../services/menu.service.js";
import { PermissionService } from "../../../../../services/permission.service.js";
import { registerRoutePermissions as registerPermissions } from '@/route-permissions'
import type { PermissionRef } from '@yishan/core-api/permissions/catalog';

const PERMS: { readonly [k: string]: PermissionRef } = Object.freeze({
  LOGIN:    { code: 'app:auth:login',    label: '移动端-登录', group: 'app-auth' },
  LOGOUT:   { code: 'app:auth:logout',   label: '移动端-登出', group: 'app-auth' },
  REFRESH:  { code: 'app:auth:refresh',  label: '移动端-刷新令牌', group: 'app-auth' },
  PROFILE:  { code: 'app:auth:profile',  label: '移动端-当前用户', group: 'app-auth' },
});

/**
 * 移动端认证路由 - /api/v1/app/auth
 * 复用 core 的 AuthService，保持与 admin 通道同等的 token 行为
 */
const auth: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  registerPermissions(...Object.values(PERMS));
  const route = createRouteRegistrar(fastify);
  // POST /api/v1/app/auth/login
  route.post(
    "/login",
    {
      access: { permission: PERMS.LOGIN, public: true },
      // Section 7：移动端登录限流
      preHandler: [fastify.rateLimit("login")],
      schema: {
        summary: "移动端登录",
        description: "移动端通过用户名/邮箱和密码登录",
        operationId: "appLogin",
        tags: ["app-auth"],
        body: { $ref: "loginReq#" },
        response: { 200: { $ref: "loginResp#" } },
      },
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      const result = await AuthService.login(
        request.body as LoginReq,
        fastify,
        request.ip,
        request.headers["user-agent"] as string | undefined
      );
      return ResponseUtil.success(reply, result, "登录成功");
    }
  );

  // POST /api/v1/app/auth/logout
  route.post(
    "/logout",
    {
      // softAuth: true —— 允许请求体 `{ token }` 作为 Authorization header 的回退，
      // 解决"鸡生蛋"场景：access token 过期时客户端仍可凭 refresh token / 当前 token 撤销。
      access: { permission: PERMS.LOGOUT, softAuth: true },
      schema: {
        summary: "移动端登出",
        description: "撤销当前用户的访问令牌",
        operationId: "appLogout",
        tags: ["app-auth"],
        security: [{ bearerAuth: [] }],
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
      // 鉴权由 fastify.authenticate 完成；只按当前用户 ID 撤销其所有活跃 token。
      const currentUser = request.currentUser;
      if (!currentUser?.id) {
        throw new BusinessError(ValidationErrorCode.INVALID_PARAMETER, "缺少认证token");
      }
      await AuthService.logout(currentUser.id, fastify);
      return ResponseUtil.success(reply, null, "退出成功");
    }
  );

  // POST /api/v1/app/auth/refresh
  route.post(
    "/refresh",
    {
      access: { permission: PERMS.REFRESH, public: true },
      // Section 7：移动端 refresh 限流
      preHandler: [fastify.rateLimit("refresh")],
      schema: {
        summary: "移动端刷新令牌",
        description: "使用 refreshToken 换取新的访问令牌",
        operationId: "appRefreshToken",
        tags: ["app-auth"],
        body: { $ref: "refreshTokenReq#" },
        response: { 200: { $ref: "refreshTokenResp#" } },
      },
    },
    async (
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      const { refreshToken } = request.body as RefreshTokenReq;
      if (!refreshToken) {
        throw new BusinessError(AuthErrorCode.REFRESH_TOKEN_INVALID, "缺少刷新令牌");
      }
      const result = await AuthService.refreshToken(refreshToken, fastify);
      return ResponseUtil.success(reply, result, "刷新成功");
    }
  );

  // GET /api/v1/app/auth/me
  route.get(
    "/me",
    {
      access: { permission: PERMS.PROFILE },
      schema: {
        summary: "获取当前用户信息",
        description: "获取当前登录用户的详细信息及已授权菜单路径",
        operationId: "appGetCurrentUser",
        tags: ["app-auth"],
        security: [{ bearerAuth: [] }],
        response: { 200: { $ref: "currentUserResp#" } },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const currentUser = request.currentUser;
      const roleIds = currentUser?.roleIds ?? [];
      const accessPath = await MenuService.getAuthorizedMenuPaths(roleIds);
      const { roleCodes } = await PermissionService.loadForRoleIds(roleIds);
      const result = { ...currentUser, accessPath, roleCodes: [...roleCodes] };
      return ResponseUtil.success(reply, result, "获取成功");
    }
  );

  // GET /api/v1/app/auth/capabilities
  route.get(
    "/capabilities",
    {
      // Reuse the authenticated profile permission so this endpoint does not
      // introduce a second role grant for the same mobile session bootstrap.
      access: { permission: PERMS.PROFILE },
      schema: {
        summary: "获取移动端能力",
        description: "返回当前用户实际权限及当前启用的业务模块",
        operationId: "appGetCapabilities",
        tags: ["app-auth"],
        security: [{ bearerAuth: [] }],
        response: { 200: { $ref: "mobileCapabilitiesResp#" } },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const roleIds = request.currentUser?.roleIds ?? [];
      const capabilities = await PermissionService.getMobileCapabilities(
        roleIds,
        fastify.moduleLoader,
        request.tokenScope,
      );
      return ResponseUtil.success(reply, capabilities, "获取能力成功");
    },
  );
};

export default auth;
