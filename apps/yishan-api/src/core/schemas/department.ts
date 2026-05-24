/**
 * 部门相关的 TypeBox Schema 定义
 */

import { Static, Type } from "@sinclair/typebox";
import { PaginationQuerySchema, successResponse } from "./common.js";
import { FastifyInstance } from "fastify";

// 部门基础信息 Schema
const SysDeptSchema = Type.Object(
  {
    id: Type.Number({ description: "部门ID", example: 1 }),
    name: Type.String({ description: "部门名称", example: "技术部" }),
    parentId: Type.Optional(Type.Number({ description: "上级部门ID", example: 0 })),
    parentName: Type.Optional(Type.String({ description: "上级部门名称", example: "总部" })),
    status: Type.String({ enum: ["0", "1"], description: "状态（0-禁用，1-启用）", example: "1" }),
    sort_order: Type.Number({ description: "排序序号", example: 10 }),
    description: Type.Optional(Type.String({ description: "部门描述", example: "负责公司技术研发" })),
    leaderId: Type.Optional(Type.Number({ description: "负责人ID", example: 2 })),
    leaderName: Type.Optional(Type.String({ description: "负责人名称", example: "张三" })),
    creatorId: Type.Optional(Type.Number({ description: "创建人Id", example: 1 })),
    creatorName: Type.Optional(Type.String({ description: "创建人名称", example: "admin" })),
    createdAt: Type.String({ format: "date-time", description: "创建时间" }),
    updaterId: Type.Optional(Type.Number({ description: "更新人Id", example: 1 })),
    updaterName: Type.Optional(Type.String({ description: "更新人名称", example: "admin" })),
    updatedAt: Type.String({ format: "date-time", description: "更新时间" }),
  },
  { $id: "sysDept" }
);

export type SysDeptResp = Static<typeof SysDeptSchema>;

// 创建部门请求 Schema
const CreateDeptReqSchema = Type.Object(
  {
    name: Type.String({ description: "部门名称", minLength: 1, maxLength: 100 }),
    parentId: Type.Optional(Type.Number({ description: "上级部门ID" })),
    status: Type.Optional(Type.String({ enum: ["0", "1"], description: "状态", default: "1" })),
    sort_order: Type.Optional(Type.Number({ description: "排序序号", default: 0 })),
    description: Type.Optional(Type.String({ description: "部门描述", maxLength: 255 })),
    leaderId: Type.Optional(Type.Number({ description: "负责人ID" })),
  },
  { $id: "createDeptReq" }
);

// 更新部门请求 Schema
const UpdateDeptReqSchema = Type.Partial(CreateDeptReqSchema, { $id: "updateDeptReq", minProperties: 1 });

export type CreateDeptReq = Static<typeof CreateDeptReqSchema>;
export type UpdateDeptReq = Static<typeof UpdateDeptReqSchema>;

// 部门列表查询参数 Schema
const DeptListQuerySchema = Type.Object(
  {
    ...PaginationQuerySchema.properties,
    keyword: Type.Optional(Type.String({ description: "搜索关键词（名称、描述）" })),
    status: Type.Optional(Type.String({ enum: ["0", "1"], description: "部门状态" })),
    parentId: Type.Optional(Type.Number({ description: "上级部门ID过滤" })),
    sortBy: Type.Optional(
      Type.String({ enum: ["sort_order", "createdAt", "updatedAt"], default: "sort_order", description: "排序字段" })
    ),
    sortOrder: Type.Optional(Type.String({ enum: ["asc", "desc"], default: "asc", description: "排序方向" })),
  },
  { $id: "deptListQuery" }
);

export type DeptListQuery = Static<typeof DeptListQuerySchema>;

// 获取部门列表响应
const DeptListRespSchema = successResponse({ data: Type.Array(Type.Ref("sysDept")), $id: "deptListResp", includePagination: true });

// 获取部门详情响应
const DeptDetailRespSchema = successResponse({ data: Type.Ref("sysDept"), $id: "deptDetailResp" });

// 删除部门响应
const DeptDeleteRespSchema = successResponse({
  data: Type.Object({ id: Type.Number({ description: "部门ID" }) }),
  $id: "deptDeleteResp",
  message: "删除成功",
});

const DeptTreeNodeSchema = Type.Object(
  {
    ...SysDeptSchema.properties,
    children: Type.Union([Type.Array(Type.Ref("deptTreeNode")), Type.Null()]),
  },
  { $id: "deptTreeNode" }
);

export type DeptTreeNode = Static<typeof DeptTreeNodeSchema>;

const DeptDeptTreeListSchema = Type.Array((Type.Ref("deptTreeNode")), { $id: "deptTreeList" });

// 部门树响应（内联递归定义，避免外部 $ref 解析问题）
const DeptTreeRespSchema = successResponse({
  data: Type.Ref('deptTreeList'),
  $id: "deptTreeResp",
  message: "获取部门树成功",
});

const registerDepartment = (fastify: FastifyInstance) => {
  fastify.addSchema(SysDeptSchema);
  fastify.addSchema(DeptListQuerySchema);
  fastify.addSchema(DeptListRespSchema);
  fastify.addSchema(CreateDeptReqSchema);
  fastify.addSchema(UpdateDeptReqSchema);
  fastify.addSchema(DeptDetailRespSchema);
  fastify.addSchema(DeptDeleteRespSchema);
  fastify.addSchema(DeptTreeNodeSchema);
  fastify.addSchema(DeptDeptTreeListSchema);
  fastify.addSchema(DeptTreeRespSchema);
};

export default registerDepartment;
