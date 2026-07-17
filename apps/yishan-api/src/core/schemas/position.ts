/**
 * 岗位相关的 TypeBox Schema 定义
 */

import { Static, Type } from "@sinclair/typebox";
import { PaginationQuerySchema, successResponse } from "./common.js";
import { FastifyInstance } from "fastify";

// 岗位基础信息 Schema
const SysPositionSchema = Type.Object(
  {
    id: Type.Number({ description: "岗位ID", example: 1 }),
    name: Type.String({ description: "岗位名称", example: "Java工程师" }),
    status: Type.String({
      enum: ["0", "1"],
      description: "状态（0-禁用，1-启用）",
      example: "1",
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
  { $id: "sysPosition" }
);

export type SysPositionResp = Static<typeof SysPositionSchema>;

// 创建岗位请求 Schema
const SavePositionReqSchema = Type.Object(
  {
    name: Type.String({ description: "岗位名称", minLength: 1, maxLength: 100 }),
    status: Type.Optional(
      Type.String({ enum: ["0", "1"], description: "状态", default: "1" })
    ),
    sort_order: Type.Optional(
      Type.Number({ description: "排序序号", default: 0 })
    ),
    description: Type.Optional(
      Type.String({ description: "岗位描述", maxLength: 255 })
    ),
  },
  { $id: "savePositionReq" }
);

const UpdatePositionReqSchema = Type.Object(
  {
    name: Type.Optional(
      Type.String({ description: "岗位名称", minLength: 1, maxLength: 100 })
    ),
    status: Type.Optional(
      Type.String({ enum: ["0", "1"], description: "状态" })
    ),
    sort_order: Type.Optional(
      Type.Number({ description: "排序序号" })
    ),
    description: Type.Optional(
      Type.String({ description: "岗位描述", maxLength: 255 })
    ),
  },
  { $id: "updatePositionReq", minProperties: 1 }
);

export type SavePositionReq = Static<typeof SavePositionReqSchema>;
export type UpdatePositionReq = Static<typeof UpdatePositionReqSchema>;

// 岗位列表查询参数 Schema
const PositionListQuerySchema = Type.Object(
  {
    ...PaginationQuerySchema.properties,
    keyword: Type.Optional(
      Type.String({ description: "搜索关键词（名称、描述）" })
    ),
    status: Type.Optional(
      Type.String({ enum: ["0", "1"], description: "岗位状态" })
    ),
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
  { $id: "positionListQuery" }
);

export type PositionListQuery = Static<typeof PositionListQuerySchema>;

// 获取岗位列表响应
const PositionListRespSchema = successResponse({
  data: Type.Array(Type.Ref("sysPosition")),
  $id: "positionListResp",
  includePagination: true,
});

// 获取岗位详情响应
const PositionDetailRespSchema = successResponse({
  data: Type.Ref("sysPosition"),
  $id: "positionDetailResp",
});

// 删除岗位响应
const PositionDeleteRespSchema = successResponse({
  data: Type.Object({ id: Type.Number({ description: "岗位ID" }) }),
  $id: "positionDeleteResp",
  message: "删除成功",
});

const registerPosition = (fastify: FastifyInstance) => {
  fastify.addSchema(SysPositionSchema);
  fastify.addSchema(PositionListQuerySchema);
  fastify.addSchema(PositionListRespSchema);
  fastify.addSchema(SavePositionReqSchema);
  fastify.addSchema(UpdatePositionReqSchema);
  fastify.addSchema(PositionDetailRespSchema);
  fastify.addSchema(PositionDeleteRespSchema);
};

export default registerPosition;
