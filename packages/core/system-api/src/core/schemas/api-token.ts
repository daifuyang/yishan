import { Type } from "@sinclair/typebox";
import { FastifyInstance } from "fastify";
import { successResponse } from "./common.js";

export const ApiTokenRecordSchema = Type.Object(
  {
    id: Type.Integer(),
    name: Type.String(),
    scopes: Type.Array(Type.String(), {
      description: "授权范围 (Section 2 PAT scopes)。空数组表示无任何权限。",
      default: [],
    }),
    userId: Type.Integer(),
    expiresAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
    lastUsedAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
    lastUsedIp: Type.Union([Type.String(), Type.Null()]),
    createdAt: Type.String({ format: "date-time" }),
    updatedAt: Type.String({ format: "date-time" }),
  },
  { $id: "apiTokenRecord" },
);

// Preset duration values for API Token expiry. Mutually exclusive with expiresAt.
// If neither is provided, the route defaults to "30d".
export const ApiTokenDurationSchema = Type.Union(
  [
    Type.Literal("7d"),
    Type.Literal("30d"),
    Type.Literal("60d"),
    Type.Literal("90d"),
    Type.Literal("1y"),
    Type.Literal("never"),
  ],
  { $id: "apiTokenDuration" },
);

export const ApiTokenCreateReqSchema = Type.Object(
  {
    name: Type.String({ minLength: 1, maxLength: 100 }),
    duration: Type.Optional(
      Type.String({
        $ref: "apiTokenDuration#",
        description:
          '预设过期时长。与 expiresAt 互斥。若都不传,默认为 "30d"。',
      }),
    ),
    expiresAt: Type.Optional(
      Type.String({
        format: "date-time",
        description: "自定义过期时间(ISO datetime)。与 duration 互斥。",
      }),
    ),
    scopes: Type.Optional(
      Type.Array(Type.String(), {
        description:
          "授权范围（permission code 列表）。为空/不传 = 创建空 scopes（保守默认，无任何资源授权）。" +
          " 特殊值：'*' = 完全继承用户角色权限（含 super_admin 旁路）；" +
          "'__super_admin__' = 显式要求保留 super_admin 旁路；" +
          "其余 code 必须是 PERMISSION_CODES 中已登记的静态 code 或 manifest 注册的扩展 code，" +
          "未知 code 将被拒绝（400 INVALID_PARAMETER）。",
        default: [],
      }),
    ),
  },
  { $id: "apiTokenCreateReq" },
);

const ApiTokenCreateDataSchema = Type.Object(
  {
    id: Type.Integer(),
    name: Type.String(),
    scopes: Type.Array(Type.String()),
    userId: Type.Integer(),
    expiresAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
    createdAt: Type.String({ format: "date-time" }),
    // The one-time plaintext:
    token: Type.String(),
  },
  { $id: "apiTokenCreateData" },
);

const ApiTokenListDataSchema = Type.Object(
  {
    list: Type.Array(Type.Ref("apiTokenRecord")),
    total: Type.Integer(),
  },
  { $id: "apiTokenListData" },
);

export const ApiTokenDeleteDataSchema = Type.Object(
  {
    id: Type.Integer(),
  },
  { $id: "apiTokenDeleteData" },
);

export const ApiTokenCreateRespSchema = successResponse({
  data: Type.Ref("apiTokenCreateData"),
  $id: "apiTokenCreateResp",
});

export const ApiTokenRecordRespSchema = successResponse({
  data: Type.Ref("apiTokenRecord"),
  $id: "apiTokenRecordResp",
});

export const ApiTokenListRespSchema = successResponse({
  data: Type.Ref("apiTokenListData"),
  $id: "apiTokenListResp",
});

export const ApiTokenDeleteRespSchema = successResponse({
  data: Type.Ref("apiTokenDeleteData"),
  $id: "apiTokenDeleteResp",
});

// ============================================================================
// Available Scopes (for GET /me/api-tokens/available-scopes)
// ============================================================================

/** 单个可用权限项 */
export const AvailableScopeItemSchema = Type.Object(
  {
    value: Type.String({ description: "权限码，如 system:user:list" }),
    label: Type.String({ description: "展示用中文标签，如 用户管理-列表" }),
    description: Type.Optional(Type.String({ description: "可选的描述/提示文本" })),
  },
  { $id: "availableScopeItem" },
);

/** 权限分组 */
export const AvailableScopeGroupSchema = Type.Object(
  {
    label: Type.String({ description: "分组名称，如 系统管理" }),
    system: Type.Union([
      Type.Literal("system", { description: "系统管理" }),
      Type.Literal("shop", { description: "商城管理" }),
      Type.Literal("portal", { description: "门户管理" }),
      Type.Literal("special", { description: "特殊权限" }),
    ]),
    options: Type.Array(Type.Ref("availableScopeItem")),
  },
  { $id: "availableScopeGroup" },
);

/** 可用权限范围响应 */
export const AvailableScopesRespSchema = successResponse({
  data: Type.Object({
    groups: Type.Array(Type.Ref("availableScopeGroup")),
  }),
  $id: "availableScopesResp",
});

export const registerApiToken = (fastify: FastifyInstance) => {
  fastify.addSchema(ApiTokenRecordSchema);
  fastify.addSchema(ApiTokenDurationSchema);
  fastify.addSchema(ApiTokenCreateReqSchema);
  fastify.addSchema(ApiTokenCreateDataSchema);
  fastify.addSchema(ApiTokenListDataSchema);
  fastify.addSchema(ApiTokenDeleteDataSchema);
  fastify.addSchema(ApiTokenCreateRespSchema);
  fastify.addSchema(ApiTokenRecordRespSchema);
  fastify.addSchema(ApiTokenListRespSchema);
  fastify.addSchema(ApiTokenDeleteRespSchema);
  // Available scopes schemas
  fastify.addSchema(AvailableScopeItemSchema);
  fastify.addSchema(AvailableScopeGroupSchema);
  fastify.addSchema(AvailableScopesRespSchema);
};

export default registerApiToken;