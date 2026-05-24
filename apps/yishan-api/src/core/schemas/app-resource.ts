import { Static, Type } from "@sinclair/typebox";
import { PaginationQuerySchema, successResponse } from "./common.js";
import { FastifyInstance } from "fastify";

const AppResourceTypeSchema = Type.String({
  enum: [
    "FORM",
    "PROCESS_FORM",
    "REPORT",
    "PORTAL_BROADCAST",
    "DASHBOARD",
    "CUSTOM_PAGE",
    "EXTERNAL_LINK",
    "FOLDER",
  ],
  description: "资源类型",
  $id: "appResourceType",
});

const SysAppResourceSchema = Type.Object(
  {
    id: Type.Number({ description: "资源ID", example: 1 }),
    appId: Type.Number({ description: "应用ID", example: 1 }),
    parentId: Type.Optional(Type.Number({ description: "父级资源ID（分组）", example: 0 })),
    type: AppResourceTypeSchema,
    name: Type.String({ description: "资源名称", example: "用户表单" }),
    description: Type.Optional(Type.String({ description: "资源描述", example: "用户信息收集表单" })),
    status: Type.String({ enum: ["0", "1"], description: "状态（0-禁用，1-启用）", example: "1" }),
    sort_order: Type.Number({ description: "排序序号", example: 10 }),
    config: Type.Optional(Type.Any({ description: "资源配置" })),
    creatorId: Type.Optional(Type.Number({ description: "创建人ID", example: 1 })),
    creatorName: Type.Optional(Type.String({ description: "创建人名称", example: "admin" })),
    createdAt: Type.String({ format: "date-time", description: "创建时间" }),
    updaterId: Type.Optional(Type.Number({ description: "更新人ID", example: 1 })),
    updaterName: Type.Optional(Type.String({ description: "更新人名称", example: "admin" })),
    updatedAt: Type.String({ format: "date-time", description: "更新时间" }),
  },
  { $id: "sysAppResource" }
);

export type SysAppResourceResp = Static<typeof SysAppResourceSchema>;

const CreateAppResourceReqSchema = Type.Object(
  {
    type: AppResourceTypeSchema,
    parentId: Type.Optional(Type.Number({ description: "父级资源ID（分组）" })),
    name: Type.String({ description: "资源名称", minLength: 1, maxLength: 100 }),
    description: Type.Optional(Type.String({ description: "资源描述", maxLength: 255 })),
    status: Type.Optional(Type.String({ enum: ["0", "1"], description: "状态", default: "1" })),
    sort_order: Type.Optional(Type.Number({ description: "排序序号", default: 0 })),
    config: Type.Optional(Type.Any({ description: "资源配置" })),
  },
  { $id: "createAppResourceReq" }
);

const UpdateAppResourceReqSchema = Type.Partial(CreateAppResourceReqSchema, {
  $id: "updateAppResourceReq",
  minProperties: 1,
});

export type CreateAppResourceReq = Static<typeof CreateAppResourceReqSchema>;
export type UpdateAppResourceReq = Static<typeof UpdateAppResourceReqSchema>;

const AppResourceListQuerySchema = Type.Object(
  {
    ...PaginationQuerySchema.properties,
    keyword: Type.Optional(Type.String({ description: "搜索关键词（名称、描述）" })),
    type: Type.Optional(AppResourceTypeSchema),
    parentId: Type.Optional(Type.Number({ description: "父级资源ID过滤" })),
    status: Type.Optional(Type.String({ enum: ["0", "1"], description: "状态" })),
    sortBy: Type.Optional(
      Type.String({
        enum: ["sort_order", "createdAt", "updatedAt"],
        default: "sort_order",
        description: "排序字段",
      })
    ),
    sortOrder: Type.Optional(Type.String({ enum: ["asc", "desc"], default: "asc", description: "排序方向" })),
  },
  { $id: "appResourceListQuery" }
);

export type AppResourceListQuery = Static<typeof AppResourceListQuerySchema>;

const AppResourceListRespSchema = successResponse({
  data: Type.Array(Type.Ref("sysAppResource")),
  $id: "appResourceListResp",
  includePagination: true,
});

const AppResourceDetailRespSchema = successResponse({
  data: Type.Ref("sysAppResource"),
  $id: "appResourceDetailResp",
});

const AppResourceDeleteRespSchema = successResponse({
  data: Type.Object({ id: Type.Number({ description: "资源ID" }) }),
  $id: "appResourceDeleteResp",
  message: "删除成功",
});

const AppResourceTreeNodeSchema = Type.Object(
  {
    ...SysAppResourceSchema.properties,
    children: Type.Union([Type.Array(Type.Ref("appResourceTreeNode")), Type.Null()]),
  },
  { $id: "appResourceTreeNode" }
);

export type AppResourceTreeNode = Static<typeof AppResourceTreeNodeSchema>;

const AppResourceTreeListSchema = Type.Array(Type.Ref("appResourceTreeNode"), { $id: "appResourceTreeList" });

const AppResourceTreeRespSchema = successResponse({
  data: Type.Ref("appResourceTreeList"),
  $id: "appResourceTreeResp",
  message: "获取应用资源树成功",
});

const registerAppResourceSchemas = (fastify: FastifyInstance) => {
  fastify.addSchema(AppResourceTypeSchema);
  fastify.addSchema(SysAppResourceSchema);
  fastify.addSchema(CreateAppResourceReqSchema);
  fastify.addSchema(UpdateAppResourceReqSchema);
  fastify.addSchema(AppResourceListQuerySchema);
  fastify.addSchema(AppResourceListRespSchema);
  fastify.addSchema(AppResourceDetailRespSchema);
  fastify.addSchema(AppResourceDeleteRespSchema);
  fastify.addSchema(AppResourceTreeNodeSchema);
  fastify.addSchema(AppResourceTreeListSchema);
  fastify.addSchema(AppResourceTreeRespSchema);
};

export default registerAppResourceSchemas;
