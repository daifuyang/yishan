import { Static, Type } from "@sinclair/typebox";
import { PaginationQuerySchema, successResponse } from "./common.js";
import { FastifyInstance } from "fastify";

const SysAppSchema = Type.Object(
  {
    id: Type.Number(),
    name: Type.String(),
    icon: Type.Optional(Type.String()),
    iconColor: Type.Optional(Type.String()),
    status: Type.String({ enum: ["0", "1"], default: "1" }),
    sort_order: Type.Number(),
    description: Type.Optional(Type.String()),
    creatorId: Type.Optional(Type.Number()),
    creatorName: Type.Optional(Type.String()),
    createdAt: Type.String({ format: "date-time" }),
    updaterId: Type.Optional(Type.Number()),
    updaterName: Type.Optional(Type.String()),
    updatedAt: Type.String({ format: "date-time" }),
  },
  { $id: "sysApp" }
);

export type SysAppResp = Static<typeof SysAppSchema>;

const SaveAppReqSchema = Type.Object(
  {
    name: Type.String({ minLength: 1, maxLength: 100 }),
    icon: Type.Optional(Type.String({ maxLength: 100 })),
    iconColor: Type.Optional(Type.String({ maxLength: 50 })),
    status: Type.Optional(Type.String({ enum: ["0", "1"], default: "1" })),
    sort_order: Type.Optional(Type.Number({ default: 0 })),
    description: Type.Optional(Type.String({ maxLength: 255 })),
  },
  { $id: "saveAppReq" }
);

const UpdateAppReqSchema = Type.Object(
  {
    name: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
    icon: Type.Optional(Type.String({ maxLength: 100 })),
    iconColor: Type.Optional(Type.String({ maxLength: 50 })),
    status: Type.Optional(Type.String({ enum: ["0", "1"] })),
    sort_order: Type.Optional(Type.Number()),
    description: Type.Optional(Type.String({ maxLength: 255 })),
  },
  { $id: "updateAppReq", minProperties: 1 }
);

export type SaveAppReq = Static<typeof SaveAppReqSchema>;
export type UpdateAppReq = Static<typeof UpdateAppReqSchema>;

const AppListQuerySchema = Type.Object(
  {
    ...PaginationQuerySchema.properties,
    keyword: Type.Optional(Type.String()),
    status: Type.Optional(Type.String({ enum: ["0", "1"] })),
    sortBy: Type.Optional(Type.String({ enum: ["sort_order", "createdAt", "updatedAt"], default: "sort_order" })),
    sortOrder: Type.Optional(Type.String({ enum: ["asc", "desc"], default: "asc" })),
  },
  { $id: "appListQuery" }
);

export type AppListQuery = Static<typeof AppListQuerySchema>;

const AppListRespSchema = successResponse({
  data: Type.Array(Type.Ref("sysApp")),
  $id: "appListResp",
  includePagination: true,
});

const AppDetailRespSchema = successResponse({
  data: Type.Ref("sysApp"),
  $id: "appDetailResp",
});

const AppDeleteRespSchema = successResponse({
  data: Type.Object({ id: Type.Number() }),
  $id: "appDeleteResp",
  message: "删除成功",
});

const registerAppSchemas = (fastify: FastifyInstance) => {
  fastify.addSchema(SysAppSchema);
  fastify.addSchema(SaveAppReqSchema);
  fastify.addSchema(UpdateAppReqSchema);
  fastify.addSchema(AppListQuerySchema);
  fastify.addSchema(AppListRespSchema);
  fastify.addSchema(AppDetailRespSchema);
  fastify.addSchema(AppDeleteRespSchema);
};

export default registerAppSchemas;
