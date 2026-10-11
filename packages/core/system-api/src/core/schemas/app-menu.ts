/**
 * App 工作台菜单的 TypeBox Schema。独立于 Web 的 sys_menu。
 */

import { Static, Type } from "@sinclair/typebox";
import { FastifyInstance } from "fastify";
import { successResponse } from "./common.js";

const AppMenuNodeSchema = Type.Object(
  {
    id: Type.Number({ description: "工作台菜单ID", example: 1 }),
    parentId: Type.Optional(Type.Number({ description: "分组ID，分组本身为空" })),
    type: Type.Integer({ enum: [0, 1], description: "类型（0:分组,1:应用入口）", example: 1 }),
    name: Type.String({ description: "名称", example: "通讯录" }),
    icon: Type.Optional(Type.String({ description: "图标名", maxLength: 100 })),
    page: Type.Optional(Type.String({ description: "App 页面入口，如 pages/contacts/index/index" })),
    moduleId: Type.String({ description: "所属模块ID，系统为 core", example: "core" }),
    sortOrder: Type.Number({ description: "同级排序，越小越靠前", example: 10 }),
    status: Type.String({ enum: ["0", "1"], description: "状态（0-禁用，1-启用）", example: "1" }),
    createdAt: Type.String({ format: "date-time", description: "创建时间" }),
    updatedAt: Type.String({ format: "date-time", description: "更新时间" }),
    children: Type.Optional(Type.Union([Type.Array(Type.Ref("appMenuNode")), Type.Null()])),
  },
  { $id: "appMenuNode" }
);

export type AppMenuNode = Static<typeof AppMenuNodeSchema>;

// Optional 字段不设 default：UpdateAppMenuReq 由 Partial 派生，默认值会在更新时覆盖原值。
const SaveAppMenuReqSchema = Type.Object(
  {
    name: Type.String({ description: "名称", minLength: 1, maxLength: 100 }),
    type: Type.Optional(Type.Integer({ enum: [0, 1], description: "类型（0:分组,1:应用入口）" })),
    parentId: Type.Optional(Type.Number({ description: "分组ID，应用入口必填" })),
    icon: Type.Optional(Type.String({ description: "图标名", maxLength: 100 })),
    page: Type.Optional(Type.String({ description: "App 页面入口", maxLength: 255 })),
    moduleId: Type.Optional(Type.String({ description: "所属模块ID", maxLength: 64 })),
    sortOrder: Type.Optional(Type.Number({ description: "同级排序" })),
    status: Type.Optional(Type.String({ enum: ["0", "1"], description: "状态" })),
  },
  { $id: "saveAppMenuReq" }
);

const UpdateAppMenuReqSchema = Type.Partial(SaveAppMenuReqSchema, {
  $id: "updateAppMenuReq",
  minProperties: 1,
});

export type SaveAppMenuReq = Static<typeof SaveAppMenuReqSchema>;
export type UpdateAppMenuReq = Static<typeof UpdateAppMenuReqSchema>;

const ReorderAppMenuReqSchema = Type.Object(
  {
    parentId: Type.Optional(Type.Number({ description: "同级所属分组ID；为空表示顶层分组之间排序" })),
    orderedIds: Type.Array(Type.Number(), { minItems: 1, description: "该层级全部菜单ID，按期望顺序排列" }),
  },
  { $id: "reorderAppMenuReq" }
);

export type ReorderAppMenuReq = Static<typeof ReorderAppMenuReqSchema>;

const AppMenuDetailRespSchema = successResponse({
  data: Type.Ref("appMenuNode"),
  $id: "appMenuDetailResp",
});

const AppMenuTreeListSchema = Type.Array(Type.Ref("appMenuNode"), { $id: "appMenuTreeList" });

const AppMenuTreeRespSchema = successResponse({
  data: Type.Ref("appMenuTreeList"),
  $id: "appMenuTreeResp",
  message: "获取工作台菜单成功",
});

const AppMenuDeleteRespSchema = successResponse({
  data: Type.Object({ id: Type.Number({ description: "工作台菜单ID" }) }),
  $id: "appMenuDeleteResp",
  message: "删除成功",
});

const AppMenuReorderRespSchema = successResponse({
  data: Type.Object({ count: Type.Number({ description: "已重排数量" }) }),
  $id: "appMenuReorderResp",
  message: "排序成功",
});

const registerAppMenu = (fastify: FastifyInstance) => {
  fastify.addSchema(AppMenuNodeSchema);
  fastify.addSchema(SaveAppMenuReqSchema);
  fastify.addSchema(UpdateAppMenuReqSchema);
  fastify.addSchema(ReorderAppMenuReqSchema);
  fastify.addSchema(AppMenuDetailRespSchema);
  fastify.addSchema(AppMenuTreeListSchema);
  fastify.addSchema(AppMenuTreeRespSchema);
  fastify.addSchema(AppMenuDeleteRespSchema);
  fastify.addSchema(AppMenuReorderRespSchema);
};

export default registerAppMenu;
