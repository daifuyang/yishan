import { Static, Type } from "@sinclair/typebox";
import { PaginationQuerySchema, successResponse } from "./common.js";
import { FastifyInstance } from "fastify";

const SysAppMenuSchema = Type.Object(
  {
    id: Type.Number({ description: "菜单ID", example: 1 }),
    appId: Type.Number({ description: "应用ID", example: 1 }),
    name: Type.String({ description: "菜单名称", example: "资源管理" }),
    type: Type.Integer({ enum: [0, 1, 2], description: "类型（0:目录,1:菜单,2:按钮）", example: 1 }),
    path: Type.Optional(Type.String({ description: "路由路径/URL", example: "/apps/1/resources", maxLength: 255 })),
    icon: Type.Optional(Type.String({ description: "图标名", example: "AppstoreOutlined", maxLength: 100 })),
    component: Type.Optional(Type.String({ description: "前端组件路径", example: "@/pages/AppResources", maxLength: 255 })),
    parentId: Type.Optional(Type.Number({ description: "父级菜单ID", example: 0 })),
    parentName: Type.Optional(Type.String({ description: "父级菜单名称", example: "应用管理" })),
    status: Type.String({ enum: ["0", "1"], description: "状态（0-禁用，1-启用）", example: "1" }),
    sort_order: Type.Number({ description: "排序序号", example: 10 }),
    hideInMenu: Type.Boolean({ description: "是否在菜单中隐藏", default: false }),
    isExternalLink: Type.Boolean({ description: "是否外链", default: false }),
    perm: Type.Optional(Type.String({ description: "权限标识", example: "app:menu:view", maxLength: 100 })),
    keepAlive: Type.Boolean({ description: "是否缓存页面", default: false }),
    resourceId: Type.Optional(Type.Number({ description: "关联资源ID", example: 1 })),
    creatorId: Type.Optional(Type.Number({ description: "创建人Id", example: 1 })),
    creatorName: Type.Optional(Type.String({ description: "创建人名称", example: "admin" })),
    createdAt: Type.String({ format: "date-time", description: "创建时间" }),
    updaterId: Type.Optional(Type.Number({ description: "更新人Id", example: 1 })),
    updaterName: Type.Optional(Type.String({ description: "更新人名称", example: "admin" })),
    updatedAt: Type.String({ format: "date-time", description: "更新时间" }),
  },
  { $id: "sysAppMenu" }
);

export type SysAppMenuResp = Static<typeof SysAppMenuSchema>;

const SaveAppMenuReqSchema = Type.Object(
  {
    name: Type.String({ description: "菜单名称", minLength: 1, maxLength: 100 }),
    type: Type.Optional(Type.Integer({ enum: [0, 1, 2], description: "菜单类型", default: 1 })),
    parentId: Type.Optional(Type.Number({ description: "父级菜单ID" })),
    path: Type.Optional(Type.String({ description: "路由路径/URL", maxLength: 255 })),
    icon: Type.Optional(Type.String({ description: "图标名", maxLength: 100 })),
    component: Type.Optional(Type.String({ description: "组件路径", maxLength: 255 })),
    status: Type.Optional(Type.String({ enum: ["0", "1"], description: "状态", default: "1" })),
    sort_order: Type.Optional(Type.Number({ description: "排序序号", default: 0 })),
    hideInMenu: Type.Optional(Type.Boolean({ description: "隐藏菜单", default: false })),
    isExternalLink: Type.Optional(Type.Boolean({ description: "是否外链", default: false })),
    perm: Type.Optional(Type.String({ description: "权限标识", maxLength: 100 })),
    keepAlive: Type.Optional(Type.Boolean({ description: "是否缓存", default: false })),
    resourceId: Type.Optional(Type.Number({ description: "关联资源ID" })),
  },
  { $id: "saveAppMenuReq" }
);

const UpdateAppMenuReqSchema = Type.Partial(SaveAppMenuReqSchema, {
  $id: "updateAppMenuReq",
  minProperties: 1,
});

export type SaveAppMenuReq = Static<typeof SaveAppMenuReqSchema>;
export type UpdateAppMenuReq = Static<typeof UpdateAppMenuReqSchema>;

const AppMenuListQuerySchema = Type.Object(
  {
    ...PaginationQuerySchema.properties,
    keyword: Type.Optional(Type.String({ description: "搜索关键词（名称、路径、组件、权限）" })),
    status: Type.Optional(Type.String({ enum: ["0", "1"], description: "菜单状态" })),
    type: Type.Optional(Type.Integer({ enum: [0, 1, 2], description: "菜单类型" })),
    parentId: Type.Optional(Type.Number({ description: "父级菜单ID过滤" })),
    sortBy: Type.Optional(
      Type.String({
        enum: ["sort_order", "createdAt", "updatedAt"],
        default: "sort_order",
        description: "排序字段",
      })
    ),
    sortOrder: Type.Optional(Type.String({ enum: ["asc", "desc"], default: "asc", description: "排序方向" })),
  },
  { $id: "appMenuListQuery" }
);

export type AppMenuListQuery = Static<typeof AppMenuListQuerySchema>;

const AppMenuListRespSchema = successResponse({
  data: Type.Array(Type.Ref("sysAppMenu")),
  $id: "appMenuListResp",
  includePagination: true,
});

const AppMenuDetailRespSchema = successResponse({
  data: Type.Ref("sysAppMenu"),
  $id: "appMenuDetailResp",
});

const AppMenuDeleteRespSchema = successResponse({
  data: Type.Object({ id: Type.Number({ description: "菜单ID" }) }),
  $id: "appMenuDeleteResp",
  message: "删除成功",
});

const AppMenuTreeNodeSchema = Type.Object(
  {
    ...SysAppMenuSchema.properties,
    children: Type.Union([Type.Array(Type.Ref("appMenuTreeNode")), Type.Null()]),
  },
  { $id: "appMenuTreeNode" }
);

export type AppMenuTreeNode = Static<typeof AppMenuTreeNodeSchema>;

const AppMenuTreeListSchema = Type.Array(Type.Ref("appMenuTreeNode"), { $id: "appMenuTreeList" });

const AppMenuTreeRespSchema = successResponse({
  data: Type.Ref("appMenuTreeList"),
  $id: "appMenuTreeResp",
  message: "获取应用菜单树成功",
});

const registerAppMenuSchemas = (fastify: FastifyInstance) => {
  fastify.addSchema(SysAppMenuSchema);
  fastify.addSchema(SaveAppMenuReqSchema);
  fastify.addSchema(UpdateAppMenuReqSchema);
  fastify.addSchema(AppMenuListQuerySchema);
  fastify.addSchema(AppMenuListRespSchema);
  fastify.addSchema(AppMenuDetailRespSchema);
  fastify.addSchema(AppMenuDeleteRespSchema);
  fastify.addSchema(AppMenuTreeNodeSchema);
  fastify.addSchema(AppMenuTreeListSchema);
  fastify.addSchema(AppMenuTreeRespSchema);
};

export default registerAppMenuSchemas;
