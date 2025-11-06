/**
 * 认证相关的 TypeBox Schema 定义
 */

import { Static, Type } from "@sinclair/typebox";
import { successResponse } from "./common.js";
import { FastifyInstance } from "fastify";

// 登录请求 Schema
const LoginReqSchema = Type.Object(
  {
    username: Type.String({
      description: "用户名或邮箱",
      minLength: 1,
      maxLength: 100
    }),
    password: Type.String({
      description: "密码",
      minLength: 6,
      maxLength: 50
    }),
    rememberMe: Type.Optional(
      Type.Boolean({
        description: "记住我",
        default: false
      })
    )
  },
  { $id: "loginReq" }
);

export type LoginReq = Static<typeof LoginReqSchema>;

// 登录响应数据 Schema - 优化为只返回认证信息
const LoginDataSchema = Type.Object(
  {
    token: Type.String({ description: "访问令牌" }),
    refreshToken: Type.Optional(
      Type.String({ description: "刷新令牌" })
    ),
    expiresIn: Type.Number({ description: "访问令牌过期时间（秒）" }),
    refreshTokenExpiresIn: Type.Optional(
      Type.Number({ description: "刷新令牌过期时间（秒）" })
    ),
    expiresAt: Type.Optional(
      Type.Number({ description: "访问令牌过期时间戳（毫秒）" })
    ),
    refreshTokenExpiresAt: Type.Optional(
      Type.Number({ description: "刷新令牌过期时间戳（毫秒）" })
    )
  },
  { $id: "loginData" }
);

export type LoginData = Static<typeof LoginDataSchema>;

// 登录响应 Schema
const LoginRespSchema = successResponse({
  data: Type.Ref("loginData"),
  $id: "loginResp",
});

export type LoginResp = Static<typeof LoginRespSchema>;

// 用户详细信息 Schema
const UserProfileSchema = Type.Object(
  {
    id: Type.Number({ description: "用户ID" }),
    username: Type.String({ description: "用户名" }),
    email: Type.String({ description: "邮箱" }),
    phone: Type.Optional(Type.String({ description: "手机号" })),
    realName: Type.String({ description: "真实姓名" }),
    avatar: Type.Optional(Type.String({ description: "头像URL" })),
    gender: Type.Number({
      enum: [0, 1, 2],
      description: "性别（0-未知，1-男，2-女）"
    }),
    genderName: Type.String({ description: "性别名称" }),
    birthDate: Type.Optional(
      Type.String({
        format: "date",
        description: "出生日期"
      })
    ),
    status: Type.Number({
      enum: [0, 1, 2],
      description: "状态（0-禁用，1-启用，2-锁定）"
    }),
    statusName: Type.String({ description: "状态名称" }),
    lastLoginTime: Type.Optional(
      Type.String({ format: "date-time", description: "最后登录时间" })
    ),
    lastLoginIp: Type.Optional(
      Type.String({ description: "最后登录IP" })
    ),
    loginCount: Type.Number({ description: "登录次数" }),
    createdAt: Type.String({ format: "date-time", description: "创建时间" }),
    updatedAt: Type.String({ format: "date-time", description: "更新时间" }),
  },
  { $id: "userProfile" }
);

export type UserProfile = Static<typeof UserProfileSchema>;

// 用户资料响应 Schema
const UserProfileRespSchema = successResponse({
  data: Type.Ref("userProfile"),
  $id: "userProfileResp",
});

export type UserProfileResp = Static<typeof UserProfileRespSchema>;

// 刷新令牌请求 Schema
const RefreshTokenReqSchema = Type.Object(
  {
    refreshToken: Type.String({
      description: "刷新令牌",
      minLength: 1
    })
  },
  { $id: "refreshTokenReq" }
);

export type RefreshTokenReq = Static<typeof RefreshTokenReqSchema>;

// 刷新令牌响应 Schema - 与登录响应相同
const RefreshTokenRespSchema = successResponse({
  data: Type.Ref("loginData"),
  $id: "refreshTokenResp",
});

export type RefreshTokenResp = Static<typeof RefreshTokenRespSchema>;

// 注册 Schema 到 Fastify 实例
const registerAuth = (fastify: FastifyInstance) => {
  fastify.addSchema(LoginReqSchema);
  fastify.addSchema(LoginDataSchema);
  fastify.addSchema(LoginRespSchema);
  fastify.addSchema(UserProfileSchema);
  fastify.addSchema(UserProfileRespSchema);
  fastify.addSchema(RefreshTokenReqSchema);
  fastify.addSchema(RefreshTokenRespSchema);
};

export default registerAuth;