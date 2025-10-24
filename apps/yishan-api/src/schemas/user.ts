/**
 * 用户相关的 TypeBox Schema 定义
 */

import { Static, Type } from "@sinclair/typebox";
import { PaginationQuerySchema, successResponse } from "./common.js";
import { FastifyInstance } from "fastify";

// 用户基础信息 Schema
const SysUserSchema = Type.Object(
  {
    id: Type.Number({ description: "用户ID", example: 1 }),
    username: Type.String({ description: "用户名", example: "admin" }),
    email: Type.String({
      format: "email",
      description: "邮箱",
      example: "admin@yishan.com",
    }),
    phone: Type.Optional(
      Type.String({ description: "手机号", example: "8888888" })
    ),
    realName: Type.String({ description: "真实姓名", example: "愚公" }),
    avatar: Type.Optional(Type.String({ description: "头像URL" })),
    gender: Type.Number({
      enum: [0, 1, 2],
      description: "性别（0-未知，1-男，2-女）",
      example: 1,
    }),
    genderName: Type.String({ description: "性别名称", example: "男" }),
    birthDate: Type.Optional(
      Type.String({
        format: "date",
        description: "出生日期",
        example: "2008-08-08",
      })
    ),
    status: Type.Number({
      enum: [0, 1, 2],
      description: "状态（0-禁用，1-启用，2-锁定）",
      example: 1,
    }),
    statusName: Type.String({ description: "状态名称", example: "启用" }),
    lastLoginTime: Type.Optional(
      Type.String({ format: "date-time", description: "最后登录时间" })
    ),
    lastLoginIp: Type.Optional(
      Type.String({ description: "最后登录IP", example: "127.0.0.1" })
    ),
    loginCount: Type.Number({ description: "登录次数", example: "8" }),
    creatorId: Type.Number({ description: "创建人Id", example: 1 }),
    creatorName: Type.String({ description: "创建人名称", example: "admin" }),
    createdAt: Type.String({ format: "date-time", description: "创建时间" }),
    updaterId: Type.Number({ description: "更新人Id", example: 1 }),
    updaterName: Type.String({ description: "更新人名称", example: "admin" }),
    updatedAt: Type.String({ format: "date-time", description: "更新时间" }),
  },
  { $id: "sysUser" }
);

//获取用户详情
export type SysUserResp = Static<typeof SysUserSchema>;

// 创建用户请求 Schema
const SaveUserReqSchema = Type.Object(
  {
    username: Type.String({
      description: "用户名",
      minLength: 1,
      maxLength: 50,
    }),
    email: Type.String({ format: "email", description: "邮箱" }),
    phone: Type.Optional(Type.String({ description: "手机号" })),
    realName: Type.String({
      description: "真实姓名",
      minLength: 1,
      maxLength: 50,
    }),
    avatar: Type.Optional(Type.String({ description: "头像URL" })),
    gender: Type.Optional(
      Type.Number({
        enum: [0, 1, 2],
        description: "性别（0-未知，1-男，2-女）",
      })
    ),
    birthDate: Type.Optional(
      Type.String({ format: "date", description: "出生日期" })
    ),
    status: Type.Optional(
      Type.Number({
        enum: [0, 1, 2],
        description: "状态（0-禁用，1-启用，2-锁定）",
        default: 1,
      })
    ),
  },
  { $id: "saveUserReq" }
);

// 用户列表查询参数 Schema
const UserListQuerySchema = Type.Object(
  {
    ...PaginationQuerySchema.properties,
    keyword: Type.Optional(
      Type.String({
        description: "搜索关键词（用户名、邮箱、真实姓名）",
      })
    ),
    status: Type.Optional(
      Type.Integer({
        enum: [0, 1, 2],
        description: "用户状态（0-禁用，1-启用，2-锁定）",
      })
    ),
    sortBy: Type.Optional(
      Type.String({
        enum: ["createdAt", "updatedAt", "lastLoginTime", "loginCount"],
        default: "createdAt",
        description: "排序字段",
      })
    ),
    sortOrder: Type.Optional(
      Type.String({
        enum: ["asc", "desc"],
        default: "desc",
        description: "排序方向",
      })
    ),
  },
  { $id: "userListQuery" }
);

export type UserListQuery = Static<typeof UserListQuerySchema>;
export type SaveUserReq = Static<typeof SaveUserReqSchema>;

// 获取用户列表
const UserListRespSchema = successResponse({
  data: Type.Array(Type.Ref("sysUser")),
  $id: "userListResp",
  includePagination: true,
});

// 获取用户详情
const UserDetailRespSchema = successResponse({
  data: Type.Ref("sysUser"),
  $id: "userDetailResp",
});

const registerUser = (fastify: FastifyInstance) => {
  fastify.addSchema(SysUserSchema);
  fastify.addSchema(UserListQuerySchema);
  fastify.addSchema(UserListRespSchema);
  fastify.addSchema(SaveUserReqSchema);
  fastify.addSchema(UserDetailRespSchema);
};

export default registerUser;
