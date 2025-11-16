/**
 * 角色相关的 TypeBox Schema 定义
 */

import { Static, Type } from "@sinclair/typebox";
import { PaginationQuerySchema, successResponse } from "./common.js";
import { FastifyInstance } from "fastify";

// 角色基础信息 Schema
const SysRoleSchema = Type.Object(
  {
    id: Type.Number({ description: "角色ID", example: 1 }),
    name: Type.String({ description: "角色名称", example: "管理员" }),
    description: Type.Optional(
      Type.String({ description: "角色描述", example: "系统管理员，拥有管理能力" })
    ),
    status: Type.Number({
      enum: [0, 1],
      description: "状态（0-禁用，1-启用）",
      example: 1,
    }),
    isSystemDefault: Type.Optional(
      Type.Boolean({ description: "是否系统默认角色", default: false })
    ),
    creatorId: Type.Optional(Type.Number({ description: "创建人Id", example: 1 })),
    creatorName: Type.Optional(Type.String({ description: "创建人名称", example: "admin" })),
    createdAt: Type.String({ format: "date-time", description: "创建时间" }),
    updaterId: Type.Optional(Type.Number({ description: "更新人Id", example: 1 })),
    updaterName: Type.Optional(Type.String({ description: "更新人名称", example: "admin" })),
    updatedAt: Type.String({ format: "date-time", description: "更新时间" }),
    menuIds: Type.Optional(Type.Array(Type.Number(), { description: "菜单ID列表" })),
  },
  { $id: "sysRole" }
);

export type SysRoleResp = Static<typeof SysRoleSchema>;

// 创建角色请求 Schema
const SaveRoleReqSchema = Type.Object(
  {
    name: Type.String({
      description: "角色名称",
      minLength: 1,
      maxLength: 50,
    }),
    description: Type.Optional(
      Type.String({ description: "角色描述", maxLength: 255 })
    ),
    status: Type.Optional(
      Type.Number({ enum: [0, 1], description: "状态（0-禁用，1-启用）", default: 1 })
    ),
    menuIds: Type.Optional(Type.Array(Type.Number(), { description: "菜单ID列表" })),
  },
  { $id: "saveRoleReq" }
);

// 更新角色请求 Schema
const UpdateRoleReqSchema = Type.Partial(SaveRoleReqSchema, {
  $id: "updateRoleReq",
  minProperties: 1,
});

export type SaveRoleReq = Static<typeof SaveRoleReqSchema>;
export type UpdateRoleReq = Static<typeof UpdateRoleReqSchema>;

// 角色列表查询参数 Schema
const RoleListQuerySchema = Type.Object(
  {
    ...PaginationQuerySchema.properties,
    keyword: Type.Optional(
      Type.String({ description: "搜索关键词（角色名称、描述）" })
    ),
    status: Type.Optional(
      Type.Integer({ enum: [0, 1], description: "角色状态（0-禁用，1-启用）" })
    ),
    sortBy: Type.Optional(
      Type.String({
        enum: ["createdAt", "updatedAt"],
        default: "createdAt",
        description: "排序字段",
      })
    ),
    sortOrder: Type.Optional(
      Type.String({ enum: ["asc", "desc"], default: "desc", description: "排序方向" })
    ),
  },
  { $id: "roleListQuery" }
);

export type RoleListQuery = Static<typeof RoleListQuerySchema>;

// 获取角色列表响应
const RoleListRespSchema = successResponse({
  data: Type.Array(Type.Ref("sysRole")),
  $id: "roleListResp",
  includePagination: true,
});

// 获取角色详情响应
const RoleDetailRespSchema = successResponse({
  data: Type.Ref("sysRole"),
  $id: "roleDetailResp",
});

// 删除角色响应
const RoleDeleteRespSchema = successResponse({
  data: Type.Object({
    id: Type.Number({ description: "角色ID" }),
  }),
  $id: "roleDeleteResp",
  message: "删除成功",
});

const registerRole = (fastify: FastifyInstance) => {
  fastify.addSchema(SysRoleSchema);
  fastify.addSchema(RoleListQuerySchema);
  fastify.addSchema(RoleListRespSchema);
  fastify.addSchema(SaveRoleReqSchema);
  fastify.addSchema(UpdateRoleReqSchema);
  fastify.addSchema(RoleDetailRespSchema);
  fastify.addSchema(RoleDeleteRespSchema);
};

export default registerRole;