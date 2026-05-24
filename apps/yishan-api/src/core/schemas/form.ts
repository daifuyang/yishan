import { Static, Type } from "@sinclair/typebox";
import { PaginationQuerySchema, successResponse } from "./common.js";
import { FastifyInstance } from "fastify";

const SysFormSchema = Type.Object(
  {
    id: Type.Number({ description: "表单ID（资源ID）", example: 1 }),
    appId: Type.Number({ description: "应用ID", example: 1 }),
    name: Type.String({ description: "表单名称", example: "用户登记表" }),
    description: Type.Optional(Type.String({ description: "表单描述" })),
    status: Type.String({ enum: ["0", "1"], description: "状态（0-禁用，1-启用）", example: "1" }),
    sort_order: Type.Number({ description: "排序序号", example: 10 }),
    config: Type.Optional(Type.Any({ description: "表单配置" })),
    creatorId: Type.Optional(Type.Number({ description: "创建人ID", example: 1 })),
    creatorName: Type.Optional(Type.String({ description: "创建人名称", example: "admin" })),
    createdAt: Type.String({ format: "date-time", description: "创建时间" }),
    updaterId: Type.Optional(Type.Number({ description: "更新人ID", example: 1 })),
    updaterName: Type.Optional(Type.String({ description: "更新人名称", example: "admin" })),
    updatedAt: Type.String({ format: "date-time", description: "更新时间" }),
  },
  { $id: "sysForm" }
);

export type SysFormResp = Static<typeof SysFormSchema>;

const CreateFormReqSchema = Type.Object(
  {
    name: Type.String({ description: "表单名称", minLength: 1, maxLength: 100 }),
    description: Type.Optional(Type.String({ description: "表单描述", maxLength: 255 })),
    status: Type.Optional(Type.String({ enum: ["0", "1"], description: "状态", default: "1" })),
    sort_order: Type.Optional(Type.Number({ description: "排序序号", default: 0 })),
    config: Type.Optional(Type.Any({ description: "表单配置" })),
  },
  { $id: "createFormReq" }
);

const UpdateFormReqSchema = Type.Partial(CreateFormReqSchema, {
  $id: "updateFormReq",
  minProperties: 1,
});

export type CreateFormReq = Static<typeof CreateFormReqSchema>;
export type UpdateFormReq = Static<typeof UpdateFormReqSchema>;

const FormListQuerySchema = Type.Object(
  {
    ...PaginationQuerySchema.properties,
    keyword: Type.Optional(Type.String({ description: "搜索关键词（名称、描述）" })),
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
  { $id: "formListQuery" }
);

export type FormListQuery = Static<typeof FormListQuerySchema>;

const FormListRespSchema = successResponse({
  data: Type.Array(Type.Ref("sysForm")),
  $id: "formListResp",
  includePagination: true,
});

const FormDetailRespSchema = successResponse({
  data: Type.Ref("sysForm"),
  $id: "formDetailResp",
});

const FormDeleteRespSchema = successResponse({
  data: Type.Object({ id: Type.Number({ description: "表单ID" }) }),
  $id: "formDeleteResp",
  message: "删除成功",
});

const FormFieldSchema = Type.Object(
  {
    id: Type.Number({ description: "字段ID", example: 1 }),
    resourceId: Type.Number({ description: "资源ID", example: 1 }),
    key: Type.String({ description: "字段Key", example: "username" }),
    label: Type.Optional(Type.String({ description: "字段名称", example: "用户名" })),
    type: Type.String({ description: "字段类型", example: "text" }),
    required: Type.Boolean({ description: "是否必填", default: false }),
    status: Type.String({ enum: ["0", "1"], description: "状态（0-禁用，1-启用）", example: "1" }),
    sort_order: Type.Number({ description: "排序序号", example: 10 }),
    config: Type.Optional(Type.Any({ description: "字段配置" })),
    creatorId: Type.Optional(Type.Number({ description: "创建人ID", example: 1 })),
    creatorName: Type.Optional(Type.String({ description: "创建人名称", example: "admin" })),
    createdAt: Type.String({ format: "date-time", description: "创建时间" }),
    updaterId: Type.Optional(Type.Number({ description: "更新人ID", example: 1 })),
    updaterName: Type.Optional(Type.String({ description: "更新人名称", example: "admin" })),
    updatedAt: Type.String({ format: "date-time", description: "更新时间" }),
  },
  { $id: "sysFormField" }
);

export type SysFormFieldResp = Static<typeof FormFieldSchema>;

const CreateFormFieldReqSchema = Type.Object(
  {
    key: Type.String({ description: "字段Key", minLength: 1, maxLength: 100 }),
    label: Type.Optional(Type.String({ description: "字段名称", maxLength: 100 })),
    type: Type.String({ description: "字段类型", maxLength: 50 }),
    required: Type.Optional(Type.Boolean({ description: "是否必填", default: false })),
    status: Type.Optional(Type.String({ enum: ["0", "1"], description: "状态", default: "1" })),
    sort_order: Type.Optional(Type.Number({ description: "排序序号", default: 0 })),
    config: Type.Optional(Type.Any({ description: "字段配置" })),
  },
  { $id: "createFormFieldReq" }
);

const UpdateFormFieldReqSchema = Type.Partial(CreateFormFieldReqSchema, {
  $id: "updateFormFieldReq",
  minProperties: 1,
});

export type CreateFormFieldReq = Static<typeof CreateFormFieldReqSchema>;
export type UpdateFormFieldReq = Static<typeof UpdateFormFieldReqSchema>;

const FormFieldListQuerySchema = Type.Object(
  {
    ...PaginationQuerySchema.properties,
    keyword: Type.Optional(Type.String({ description: "搜索关键词（key/label）" })),
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
  { $id: "formFieldListQuery" }
);

export type FormFieldListQuery = Static<typeof FormFieldListQuerySchema>;

const FormFieldListRespSchema = successResponse({
  data: Type.Array(Type.Ref("sysFormField")),
  $id: "formFieldListResp",
  includePagination: true,
});

const FormFieldDetailRespSchema = successResponse({
  data: Type.Ref("sysFormField"),
  $id: "formFieldDetailResp",
});

const FormFieldDeleteRespSchema = successResponse({
  data: Type.Object({ id: Type.Number({ description: "字段ID" }) }),
  $id: "formFieldDeleteResp",
  message: "删除成功",
});

const FormRecordSchema = Type.Object(
  {
    id: Type.Number({ description: "数据ID", example: 1 }),
    resourceId: Type.Number({ description: "资源ID", example: 1 }),
    data: Type.Record(Type.String(), Type.Any(), { description: "表单数据" }),
    status: Type.String({ enum: ["0", "1"], description: "状态（0-禁用，1-启用）", example: "1" }),
    creatorId: Type.Optional(Type.Number({ description: "创建人ID", example: 1 })),
    creatorName: Type.Optional(Type.String({ description: "创建人名称", example: "admin" })),
    createdAt: Type.String({ format: "date-time", description: "创建时间" }),
    updaterId: Type.Optional(Type.Number({ description: "更新人ID", example: 1 })),
    updaterName: Type.Optional(Type.String({ description: "更新人名称", example: "admin" })),
    updatedAt: Type.String({ format: "date-time", description: "更新时间" }),
  },
  { $id: "sysFormRecord" }
);

export type SysFormRecordResp = Static<typeof FormRecordSchema>;

const CreateFormRecordReqSchema = Type.Object(
  {
    data: Type.Record(Type.String(), Type.Any(), { description: "表单数据" }),
    status: Type.Optional(Type.String({ enum: ["0", "1"], description: "状态", default: "1" })),
  },
  { $id: "createFormRecordReq" }
);

const UpdateFormRecordReqSchema = Type.Partial(CreateFormRecordReqSchema, {
  $id: "updateFormRecordReq",
  minProperties: 1,
});

export type CreateFormRecordReq = Static<typeof CreateFormRecordReqSchema>;
export type UpdateFormRecordReq = Static<typeof UpdateFormRecordReqSchema>;

const FormRecordListQuerySchema = Type.Object(
  {
    ...PaginationQuerySchema.properties,
    status: Type.Optional(Type.String({ enum: ["0", "1"], description: "状态" })),
    sortBy: Type.Optional(
      Type.String({
        enum: ["createdAt", "updatedAt"],
        default: "createdAt",
        description: "排序字段",
      })
    ),
    sortOrder: Type.Optional(Type.String({ enum: ["asc", "desc"], default: "desc", description: "排序方向" })),
  },
  { $id: "formRecordListQuery" }
);

export type FormRecordListQuery = Static<typeof FormRecordListQuerySchema>;

const FormRecordListRespSchema = successResponse({
  data: Type.Array(Type.Ref("sysFormRecord")),
  $id: "formRecordListResp",
  includePagination: true,
});

const FormRecordDetailRespSchema = successResponse({
  data: Type.Ref("sysFormRecord"),
  $id: "formRecordDetailResp",
});

const FormRecordDeleteRespSchema = successResponse({
  data: Type.Object({ id: Type.Number({ description: "数据ID" }) }),
  $id: "formRecordDeleteResp",
  message: "删除成功",
});

const registerFormSchemas = (fastify: FastifyInstance) => {
  fastify.addSchema(SysFormSchema);
  fastify.addSchema(CreateFormReqSchema);
  fastify.addSchema(UpdateFormReqSchema);
  fastify.addSchema(FormListQuerySchema);
  fastify.addSchema(FormListRespSchema);
  fastify.addSchema(FormDetailRespSchema);
  fastify.addSchema(FormDeleteRespSchema);
  fastify.addSchema(FormFieldSchema);
  fastify.addSchema(CreateFormFieldReqSchema);
  fastify.addSchema(UpdateFormFieldReqSchema);
  fastify.addSchema(FormFieldListQuerySchema);
  fastify.addSchema(FormFieldListRespSchema);
  fastify.addSchema(FormFieldDetailRespSchema);
  fastify.addSchema(FormFieldDeleteRespSchema);
  fastify.addSchema(FormRecordSchema);
  fastify.addSchema(CreateFormRecordReqSchema);
  fastify.addSchema(UpdateFormRecordReqSchema);
  fastify.addSchema(FormRecordListQuerySchema);
  fastify.addSchema(FormRecordListRespSchema);
  fastify.addSchema(FormRecordDetailRespSchema);
  fastify.addSchema(FormRecordDeleteRespSchema);
};

export default registerFormSchemas;
