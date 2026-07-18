/**
 * 菜单相关的 TypeBox Schema 定义（遵循 Ant Design Pro menu 规范）
 */

import { Static, Type } from "@sinclair/typebox";
import { PaginationQuerySchema, successResponse } from "./common.js";
import { FastifyInstance } from "fastify";

// 菜单基础信息 Schema
const SysMenuSchema = Type.Object(
  {
    id: Type.Number({ description: "菜单ID", example: 1 }),
    name: Type.String({ description: "菜单名称", example: "仪表盘" }),
    type: Type.Integer({ enum: [0, 1, 2], description: "类型（0:目录,1:菜单,2:按钮）", example: 1 }),
    path: Type.Optional(Type.String({ description: "路由路径/URL", example: "/dashboard", maxLength: 255 })),
    icon: Type.Optional(Type.String({ description: "图标名", example: "DashboardOutlined", maxLength: 100 })),
    component: Type.Optional(Type.String({ description: "前端组件路径", example: "@/pages/Dashboard", maxLength: 255 })),
    parentId: Type.Optional(Type.Number({ description: "父级菜单ID", example: 0 })),
    parentName: Type.Optional(Type.String({ description: "父级菜单名称", example: "系统" })),
    status: Type.String({ enum: ["0", "1"], description: "状态（0-禁用，1-启用）", example: "1" }),
    sort_order: Type.Number({ description: "排序序号", example: 10 }),
    hideInMenu: Type.Boolean({ description: "是否在菜单中隐藏", default: false }),
    isDefaultAction: Type.Boolean({ description: "是否为页面默认访问操作", default: false }),
    isExternalLink: Type.Boolean({ description: "是否外链", default: false }),
    permissionCodes: Type.Array(Type.String(), { description: "关联功能权限码", default: [] }),
    keepAlive: Type.Boolean({ description: "是否缓存页面", default: false }),
    creatorId: Type.Optional(Type.Number({ description: "创建人Id", example: 1 })),
    creatorName: Type.Optional(Type.String({ description: "创建人名称", example: "admin" })),
    createdAt: Type.String({ format: "date-time", description: "创建时间" }),
    updaterId: Type.Optional(Type.Number({ description: "更新人Id", example: 1 })),
    updaterName: Type.Optional(Type.String({ description: "更新人名称", example: "admin" })),
    updatedAt: Type.String({ format: "date-time", description: "更新时间" }),
  },
  { $id: "sysMenu" }
);

export type SysMenuResp = Static<typeof SysMenuSchema>;

// 创建菜单请求 Schema
// 注意：Type.Optional 字段不允许设置 default。
// 否则 UpdateMenuReq = Type.Partial(SaveMenuReq) 在 Fastify Ajv（useDefaults:true）
// 校验下会把缺省字段注入默认值，导致 update 时把数据库原值覆盖。
// 缺省值由 Service 层（createMenu）显式设置。
const SaveMenuReqSchema = Type.Object(
  {
    name: Type.String({ description: "菜单名称", minLength: 1, maxLength: 100 }),
    type: Type.Optional(Type.Integer({ enum: [0, 1, 2], description: "菜单类型" })),
    parentId: Type.Optional(Type.Number({ description: "父级菜单ID" })),
    path: Type.Optional(Type.String({ description: "路由路径/URL", maxLength: 255 })),
    icon: Type.Optional(Type.String({ description: "图标名", maxLength: 100 })),
    component: Type.Optional(Type.String({ description: "组件路径", maxLength: 255 })),
    status: Type.Optional(Type.String({ enum: ["0", "1"], description: "状态" })),
    sort_order: Type.Optional(Type.Number({ description: "排序序号" })),
    hideInMenu: Type.Optional(Type.Boolean({ description: "隐藏菜单" })),
    isDefaultAction: Type.Optional(Type.Boolean({ description: "是否为页面默认访问操作" })),
    isExternalLink: Type.Optional(Type.Boolean({ description: "是否外链" })),
    permissionCodes: Type.Optional(Type.Array(Type.String({ minLength: 1, maxLength: 128 }))),
    keepAlive: Type.Optional(Type.Boolean({ description: "是否缓存" })),
  },
  { $id: "saveMenuReq" }
);

// 更新菜单请求 Schema（部分字段）
const UpdateMenuReqSchema = Type.Partial(SaveMenuReqSchema, {
  $id: "updateMenuReq",
  minProperties: 1,
});

export type SaveMenuReq = Static<typeof SaveMenuReqSchema>;
export type UpdateMenuReq = Static<typeof UpdateMenuReqSchema>;

// 菜单列表查询参数 Schema
const MenuListQuerySchema = Type.Object(
  {
    ...PaginationQuerySchema.properties,
    keyword: Type.Optional(
      Type.String({ description: "搜索关键词（名称、路径、组件、权限）" })
    ),
    status: Type.Optional(Type.String({ enum: ["0", "1"], description: "菜单状态" })),
    type: Type.Optional(Type.Integer({ enum: [0, 1, 2], description: "菜单类型" })),
    parentId: Type.Optional(Type.Number({ description: "父级菜单ID过滤" })),
    sortBy: Type.Optional(
      Type.String({
        enum: ["sortOrder", "createdAt", "updatedAt"],
        default: "sortOrder",
        description: "排序字段",
      })
    ),
    sortOrder: Type.Optional(
      Type.String({ enum: ["asc", "desc"], default: "asc", description: "排序方向" })
    ),
  },
  { $id: "menuListQuery" }
);

export type MenuListQuery = Static<typeof MenuListQuerySchema>;

// 获取菜单列表响应
const MenuListRespSchema = successResponse({
  data: Type.Array(Type.Ref("sysMenu")),
  $id: "menuListResp",
  includePagination: true,
});

// 获取菜单详情响应
const MenuDetailRespSchema = successResponse({
  data: Type.Ref("sysMenu"),
  $id: "menuDetailResp",
});

// 删除菜单响应
const MenuDeleteRespSchema = successResponse({
  data: Type.Object({ id: Type.Number({ description: "菜单ID" }) }),
  $id: "menuDeleteResp",
  message: "删除成功",
});

const MenuTreeNodeSchema = Type.Object(
  {
    ...SysMenuSchema.properties,
    // Optional so the same schema can be used by both the tree response
    // (where children is set) and the flatten response (where it's stripped).
    // Without this, the flatten handler set children: undefined and the
    // response validator threw "children" is required! → 5xx.
    children: Type.Optional(Type.Union([Type.Array(Type.Ref("menuTreeNode")), Type.Null()])),
  },
  { $id: "menuTreeNode" }
);

export type MenuTreeNode = Static<typeof MenuTreeNodeSchema>;

const MenuTreeListSchema = Type.Array(Type.Ref("menuTreeNode"), { $id: "menuTreeList" });

const MenuTreeRespSchema = successResponse({
  data: Type.Ref("menuTreeList"),
  $id: "menuTreeResp",
  message: "获取菜单树成功",
});

const MenuPathsRespSchema = successResponse({
  data: Type.Array(Type.String(), { $id: "menuPaths" }),
  $id: "menuPathsResp",
  message: "获取授权路径成功",
});

const registerMenu = (fastify: FastifyInstance) => {
  fastify.addSchema(SysMenuSchema);
  fastify.addSchema(MenuListQuerySchema);
  fastify.addSchema(MenuListRespSchema);
  fastify.addSchema(SaveMenuReqSchema);
  fastify.addSchema(UpdateMenuReqSchema);
  fastify.addSchema(MenuDetailRespSchema);
  fastify.addSchema(MenuDeleteRespSchema);
  fastify.addSchema(MenuTreeNodeSchema);
  fastify.addSchema(MenuTreeListSchema);
  fastify.addSchema(MenuTreeRespSchema);
  fastify.addSchema(MenuPathsRespSchema);
};

export default registerMenu;
