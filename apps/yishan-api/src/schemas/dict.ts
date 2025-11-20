import { Static, Type } from "@sinclair/typebox";
import { FastifyInstance } from "fastify";
import { PaginationQuerySchema, successResponse } from "./common.js";

const SysDictTypeSchema = Type.Object(
  {
    id: Type.Number(),
    name: Type.String(),
    type: Type.String(),
    status: Type.Number({ enum: [0, 1] }),
    sort_order: Type.Number(),
    remark: Type.Optional(Type.String()),
    creatorId: Type.Optional(Type.Number()),
    creatorName: Type.Optional(Type.String()),
    createdAt: Type.String({ format: "date-time" }),
    updaterId: Type.Optional(Type.Number()),
    updaterName: Type.Optional(Type.String()),
    updatedAt: Type.String({ format: "date-time" }),
  },
  { $id: "sysDictType" }
);

export type SysDictTypeResp = Static<typeof SysDictTypeSchema>;

const SaveDictTypeReqSchema = Type.Object(
  {
    name: Type.String({ minLength: 1, maxLength: 100 }),
    type: Type.String({ minLength: 1, maxLength: 100 }),
    status: Type.Optional(Type.Number({ enum: [0, 1], default: 1 })),
    sort_order: Type.Optional(Type.Number({ default: 0 })),
    remark: Type.Optional(Type.String({ maxLength: 255 })),
  },
  { $id: "saveDictTypeReq" }
);

const UpdateDictTypeReqSchema = Type.Partial(SaveDictTypeReqSchema, {
  $id: "updateDictTypeReq",
  minProperties: 1,
});

export type SaveDictTypeReq = Static<typeof SaveDictTypeReqSchema>;
export type UpdateDictTypeReq = Static<typeof UpdateDictTypeReqSchema>;

const DictTypeListQuerySchema = Type.Object(
  {
    ...PaginationQuerySchema.properties,
    keyword: Type.Optional(Type.String()),
    status: Type.Optional(Type.Integer({ enum: [0, 1] })),
    sortBy: Type.Optional(Type.String({ enum: ["sort_order", "createdAt", "updatedAt"], default: "sort_order" })),
    sortOrder: Type.Optional(Type.String({ enum: ["asc", "desc"], default: "asc" })),
  },
  { $id: "dictTypeListQuery" }
);

export type DictTypeListQuery = Static<typeof DictTypeListQuerySchema>;

const SysDictDataSchema = Type.Object(
  {
    id: Type.Number(),
    typeId: Type.Number(),
    type: Type.String(),
    label: Type.String(),
    value: Type.String(),
    status: Type.Number({ enum: [0, 1] }),
    sort_order: Type.Number(),
    tag: Type.Optional(Type.String()),
    remark: Type.Optional(Type.String()),
    isDefault: Type.Boolean(),
    creatorId: Type.Optional(Type.Number()),
    creatorName: Type.Optional(Type.String()),
    createdAt: Type.String({ format: "date-time" }),
    updaterId: Type.Optional(Type.Number()),
    updaterName: Type.Optional(Type.String()),
    updatedAt: Type.String({ format: "date-time" }),
  },
  { $id: "sysDictData" }
);

export type SysDictDataResp = Static<typeof SysDictDataSchema>;

const SaveDictDataReqSchema = Type.Object(
  {
    typeId: Type.Number(),
    label: Type.String({ minLength: 1, maxLength: 100 }),
    value: Type.String({ minLength: 1, maxLength: 100 }),
    status: Type.Optional(Type.Number({ enum: [0, 1], default: 1 })),
    sort_order: Type.Optional(Type.Number({ default: 0 })),
    tag: Type.Optional(Type.String({ maxLength: 50 })),
    remark: Type.Optional(Type.String({ maxLength: 255 })),
    isDefault: Type.Optional(Type.Boolean({ default: false })),
  },
  { $id: "saveDictDataReq" }
);

const UpdateDictDataReqSchema = Type.Partial(SaveDictDataReqSchema, {
  $id: "updateDictDataReq",
  minProperties: 1,
});

export type SaveDictDataReq = Static<typeof SaveDictDataReqSchema>;
export type UpdateDictDataReq = Static<typeof UpdateDictDataReqSchema>;

const DictDataListQuerySchema = Type.Object(
  {
    ...PaginationQuerySchema.properties,
    typeId: Type.Optional(Type.Number()),
    type: Type.Optional(Type.String()),
    keyword: Type.Optional(Type.String()),
    status: Type.Optional(Type.Integer({ enum: [0, 1] })),
    sortBy: Type.Optional(Type.String({ enum: ["sort_order", "createdAt", "updatedAt"], default: "sort_order" })),
    sortOrder: Type.Optional(Type.String({ enum: ["asc", "desc"], default: "asc" })),
  },
  { $id: "dictDataListQuery" }
);

export type DictDataListQuery = Static<typeof DictDataListQuerySchema>;

const DictTypeListResp = successResponse({ data: Type.Array(Type.Ref("sysDictType")), $id: "dictTypeListResp", includePagination: true });
const DictTypeDetailResp = successResponse({ data: Type.Ref("sysDictType"), $id: "dictTypeDetailResp" });
const DictTypeDeleteResp = successResponse({ data: Type.Object({ id: Type.Number() }), $id: "dictTypeDeleteResp" });

const DictDataListResp = successResponse({ data: Type.Array(Type.Ref("sysDictData")), $id: "dictDataListResp", includePagination: true });
const DictDataDetailResp = successResponse({ data: Type.Ref("sysDictData"), $id: "dictDataDetailResp" });
const DictDataDeleteResp = successResponse({ data: Type.Object({ id: Type.Number() }), $id: "dictDataDeleteResp" });

const DictDataMapResp = successResponse({ 
  data: Type.Record(
    Type.String(),
    Type.Array(Type.Object({
      label: Type.String(),
      value: Type.String(),
    }))
  ), 
  $id: "dictDataMapResp" 
});

const registerDict = (fastify: FastifyInstance) => {
  fastify.addSchema(SysDictTypeSchema);
  fastify.addSchema(SaveDictTypeReqSchema);
  fastify.addSchema(UpdateDictTypeReqSchema);
  fastify.addSchema(DictTypeListQuerySchema);
  fastify.addSchema(DictTypeListResp);
  fastify.addSchema(DictTypeDetailResp);
  fastify.addSchema(DictTypeDeleteResp);

  fastify.addSchema(SysDictDataSchema);
  fastify.addSchema(SaveDictDataReqSchema);
  fastify.addSchema(UpdateDictDataReqSchema);
  fastify.addSchema(DictDataListQuerySchema);
  fastify.addSchema(DictDataListResp);
  fastify.addSchema(DictDataDetailResp);
  fastify.addSchema(DictDataDeleteResp);
  fastify.addSchema(DictDataMapResp);
};

export default registerDict;