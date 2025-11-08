/**
 * 岗位相关的 TypeBox Schema 定义
 */

import { Static, Type } from "@sinclair/typebox";
import { PaginationQuerySchema, successResponse } from "./common.js";
import { FastifyInstance } from "fastify";

// 岗位基础信息 Schema
const SysPostSchema = Type.Object(
  {
    id: Type.Number({ description: "岗位ID", example: 1 }),
    name: Type.String({ description: "岗位名称", example: "Java工程师" }),
    code: Type.Optional(
      Type.String({ description: "岗位编码", example: "JAVA_DEV" })
    ),
    status: Type.Number({
      enum: [0, 1],
      description: "状态（0-禁用，1-启用）",
      example: 1,
    }),
    sort_order: Type.Number({ description: "排序序号", example: 10 }),
    description: Type.Optional(
      Type.String({ description: "岗位描述", example: "从事Java服务端开发" })
    ),
    creatorId: Type.Optional(Type.Number({ description: "创建人Id", example: 1 })),
    creatorName: Type.Optional(
      Type.String({ description: "创建人名称", example: "admin" })
    ),
    createdAt: Type.String({ format: "date-time", description: "创建时间" }),
    updaterId: Type.Optional(Type.Number({ description: "更新人Id", example: 1 })),
    updaterName: Type.Optional(
      Type.String({ description: "更新人名称", example: "admin" })
    ),
    updatedAt: Type.String({ format: "date-time", description: "更新时间" }),
  },
  { $id: "sysPost" }
);

export type SysPostResp = Static<typeof SysPostSchema>;

// 创建岗位请求 Schema
const SavePostReqSchema = Type.Object(
  {
    name: Type.String({ description: "岗位名称", minLength: 1, maxLength: 100 }),
    code: Type.Optional(
      Type.String({ description: "岗位编码", minLength: 1, maxLength: 50 })
    ),
    status: Type.Optional(
      Type.Number({ enum: [0, 1], description: "状态", default: 1 })
    ),
    sort_order: Type.Optional(
      Type.Number({ description: "排序序号", default: 0 })
    ),
    description: Type.Optional(
      Type.String({ description: "岗位描述", maxLength: 255 })
    ),
  },
  { $id: "savePostReq" }
);

// 更新岗位请求 Schema（部分字段）
const UpdatePostReqSchema = Type.Partial(SavePostReqSchema, {
  $id: "updatePostReq",
  minProperties: 1,
});

export type SavePostReq = Static<typeof SavePostReqSchema>;
export type UpdatePostReq = Static<typeof UpdatePostReqSchema>;

// 岗位列表查询参数 Schema
const PostListQuerySchema = Type.Object(
  {
    ...PaginationQuerySchema.properties,
    keyword: Type.Optional(
      Type.String({ description: "搜索关键词（名称、编码、描述）" })
    ),
    status: Type.Optional(
      Type.Integer({ enum: [0, 1], description: "岗位状态" })
    ),
    sortBy: Type.Optional(
      Type.String({
        enum: ["sort_order", "createdAt", "updatedAt"],
        default: "sort_order",
        description: "排序字段",
      })
    ),
    sortOrder: Type.Optional(
      Type.String({ enum: ["asc", "desc"], default: "asc", description: "排序方向" })
    ),
  },
  { $id: "postListQuery" }
);

export type PostListQuery = Static<typeof PostListQuerySchema>;

// 获取岗位列表响应
const PostListRespSchema = successResponse({
  data: Type.Array(Type.Ref("sysPost")),
  $id: "postListResp",
  includePagination: true,
});

// 获取岗位详情响应
const PostDetailRespSchema = successResponse({
  data: Type.Ref("sysPost"),
  $id: "postDetailResp",
});

// 删除岗位响应
const PostDeleteRespSchema = successResponse({
  data: Type.Object({ id: Type.Number({ description: "岗位ID" }) }),
  $id: "postDeleteResp",
  message: "删除成功",
});

const registerPost = (fastify: FastifyInstance) => {
  fastify.addSchema(SysPostSchema);
  fastify.addSchema(PostListQuerySchema);
  fastify.addSchema(PostListRespSchema);
  fastify.addSchema(SavePostReqSchema);
  fastify.addSchema(UpdatePostReqSchema);
  fastify.addSchema(PostDetailRespSchema);
  fastify.addSchema(PostDeleteRespSchema);
};

export default registerPost;