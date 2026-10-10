import { Static, Type } from "@sinclair/typebox";
import { PaginationQuerySchema, successResponse } from "./common.js";
import { FastifyInstance } from "fastify";

const SysLoginLogSchema = Type.Object(
  {
    id: Type.Number({ description: "日志ID", example: 1 }),
    userId: Type.Optional(Type.Number({ description: "用户ID", example: 1 })),
    username: Type.String({ description: "登录账号", example: "admin" }),
    realName: Type.Optional(Type.String({ description: "用户姓名", example: "管理员" })),
    status: Type.String({
      enum: ["0", "1"],
      description: "状态（0-失败，1-成功）",
      example: "1",
    }),
    message: Type.Optional(Type.String({ description: "提示信息", example: "登录成功" })),
    ipAddress: Type.Optional(Type.String({ description: "IP地址", example: "127.0.0.1" })),
    userAgent: Type.Optional(Type.String({ description: "User-Agent" })),
    createdAt: Type.String({ format: "date-time", description: "创建时间" }),
    updatedAt: Type.String({ format: "date-time", description: "更新时间" }),
  },
  { $id: "sysLoginLog" }
);

export type SysLoginLogResp = Static<typeof SysLoginLogSchema>;

const SysLoginLogListQuerySchema = Type.Object(
  {
    ...PaginationQuerySchema.properties,
    keyword: Type.Optional(Type.String({ description: "搜索关键词（账号、姓名、IP、提示信息）" })),
    status: Type.Optional(Type.String({ enum: ["0", "1"], description: "状态（0-失败，1-成功）" })),
    startTime: Type.Optional(Type.String({ format: "date-time", description: "开始时间" })),
    endTime: Type.Optional(Type.String({ format: "date-time", description: "结束时间" })),
    sortBy: Type.Optional(
      Type.String({
        enum: ["createdAt"],
        default: "createdAt",
        description: "排序字段",
      })
    ),
    sortOrder: Type.Optional(Type.String({ enum: ["asc", "desc"], default: "desc", description: "排序方向" })),
  },
  { $id: "sysLoginLogListQuery" }
);

export type SysLoginLogListQuery = Static<typeof SysLoginLogListQuerySchema>;

const SysLoginLogListRespSchema = successResponse({
  data: Type.Array(Type.Ref("sysLoginLog")),
  $id: "sysLoginLogListResp",
  includePagination: true,
});

const SysLoginLogDetailRespSchema = successResponse({
  data: Type.Ref("sysLoginLog"),
  $id: "sysLoginLogDetailResp",
});

const registerLoginLog = (fastify: FastifyInstance) => {
  fastify.addSchema(SysLoginLogSchema);
  fastify.addSchema(SysLoginLogListQuerySchema);
  fastify.addSchema(SysLoginLogListRespSchema);
  fastify.addSchema(SysLoginLogDetailRespSchema);
};

export default registerLoginLog;

