import { Static, Type } from "@sinclair/typebox";
import { FastifyInstance } from "fastify";
import { PaginationQuerySchema, successResponse } from "./common.js";

// 使用联合字面量以获得静态类型 "article" | "page"
const TemplateTypeSchema = Type.Union([Type.Literal("article"), Type.Literal("page")], { description: "模板类型" });

const PortalTemplateSchema = Type.Object(
  {
    id: Type.Number({ description: "模板ID", example: 1 }),
    name: Type.String({ description: "模板名称", example: "标准文章模板" }),
    description: Type.Optional(Type.String({ description: "模板描述" })),
    type: TemplateTypeSchema,
    schema: Type.Optional(Type.Ref("templateSchemaFields")),
    config: Type.Optional(Type.Any({ description: "模板配置（JSON）" })),
    status: Type.String({ enum: ["0", "1"], description: "状态（0-禁用，1-启用）", example: "1" }),
    isSystemDefault: Type.Optional(Type.Boolean({ description: "是否系统默认", default: false })),
    creatorId: Type.Optional(Type.Number({ description: "创建人Id" })),
    creatorName: Type.Optional(Type.String({ description: "创建人名称" })),
    createdAt: Type.String({ format: "date-time", description: "创建时间" }),
    updaterId: Type.Optional(Type.Number({ description: "更新人Id" })),
    updaterName: Type.Optional(Type.String({ description: "更新人名称" })),
    updatedAt: Type.String({ format: "date-time", description: "更新时间" }),
  },
  { $id: "portalTemplate" }
);

export type PortalTemplateResp = Static<typeof PortalTemplateSchema>;

const CreateTemplateReqSchema = Type.Object(
  {
    name: Type.String({ description: "模板名称", minLength: 1, maxLength: 100 }),
    description: Type.Optional(Type.String({ description: "模板描述", maxLength: 255 })),
    type: TemplateTypeSchema,
    schema: Type.Optional(Type.Ref("templateSchemaFields")),
    config: Type.Optional(Type.Any({ description: "模板配置（JSON）" })),
    status: Type.Optional(Type.String({ enum: ["0", "1"], default: "1", description: "状态" })),
    isSystemDefault: Type.Optional(Type.Boolean({ description: "是否系统默认", default: false })),
  },
  { $id: "createTemplateReq" }
);

const UpdateTemplateReqSchema = Type.Partial(Type.Omit(CreateTemplateReqSchema, ["isSystemDefault"]), { $id: "updateTemplateReq", minProperties: 1 });

export type CreateTemplateReq = Static<typeof CreateTemplateReqSchema>;
export type UpdateTemplateReq = Static<typeof UpdateTemplateReqSchema>;

const TemplateListQuerySchema = Type.Object(
  {
    ...PaginationQuerySchema.properties,
    keyword: Type.Optional(Type.String({ description: "搜索关键词（名称）" })),
    type: Type.Optional(TemplateTypeSchema),
    status: Type.Optional(Type.String({ enum: ["0", "1"], description: "状态" })),
    sortBy: Type.Optional(Type.String({ enum: ["createdAt", "updatedAt"], default: "createdAt" })),
    sortOrder: Type.Optional(Type.String({ enum: ["asc", "desc"], default: "desc" })),
  },
  { $id: "templateListQuery" }
);

export type TemplateListQuery = Static<typeof TemplateListQuerySchema>;

const AssignTemplateReqSchema = Type.Object(
  {
    templateId: Type.Union([Type.Number(), Type.Null()], { description: "模板ID（null表示取消设置）" }),
  },
  { $id: "assignTemplateReq" }
);

export type AssignTemplateReq = Static<typeof AssignTemplateReqSchema>;

const TemplateListRespSchema = successResponse({ data: Type.Array(Type.Ref("portalTemplate")), $id: "templateListResp", includePagination: true });
const TemplateDetailRespSchema = successResponse({ data: Type.Ref("portalTemplate"), $id: "templateDetailResp" });
const TemplateDeleteRespSchema = successResponse({ data: Type.Object({ id: Type.Number({ description: "模板ID" }) }), $id: "templateDeleteResp", message: "删除成功" });

const registerTemplateSchemas = (fastify: FastifyInstance) => {
  fastify.addSchema(PortalTemplateSchema);
  fastify.addSchema(CreateTemplateReqSchema);
  fastify.addSchema(UpdateTemplateReqSchema);
  fastify.addSchema(TemplateListQuerySchema);
  fastify.addSchema(TemplateListRespSchema);
  fastify.addSchema(TemplateDetailRespSchema);
  fastify.addSchema(TemplateDeleteRespSchema);
  fastify.addSchema(AssignTemplateReqSchema);
  fastify.addSchema(TemplateFieldOptionSchema);
  fastify.addSchema(TemplateFieldSchema);
  fastify.addSchema(TemplateSchemaArray);
  fastify.addSchema(UpdateTemplateSchemaReqSchema);
  fastify.addSchema(TemplateSchemaRespSchema);
};

export default registerTemplateSchemas;
// 结构元配置：用于描述前端组件及其属性
const TemplateFieldOptionSchema = Type.Object(
  {
    label: Type.String({ description: "选项文本" }),
    value: Type.Any({ description: "选项值" }),
  },
  { $id: "templateFieldOption" }
);

const TemplateFieldSchema = Type.Object(
  {
    label: Type.String({ description: "字段显示名称" }),
    type: Type.String({ description: "组件类型，如 input、radio、select 等" }),
    name: Type.Optional(Type.String({ description: "字段标识名称（可选）" })),
    required: Type.Optional(Type.Boolean({ description: "是否必填" })),
    options: Type.Optional(
      Type.Array(TemplateFieldOptionSchema, { description: "可选项（适用于 radio/select/checkbox 等）" })
    ),
    props: Type.Optional(Type.Record(Type.String(), Type.Any(), { description: "组件属性" })),
  },
  { $id: "templateField" }
);

const TemplateSchemaArray = Type.Array(TemplateFieldSchema, { $id: "templateSchemaFields" });

// 仅更新/读取模板schema的接口定义
const UpdateTemplateSchemaReqSchema = Type.Object(
  {
    schema: Type.Ref("templateSchemaFields"),
  },
  { $id: "updateTemplateSchemaReq" }
);

const TemplateSchemaRespSchema = successResponse({ data: Type.Ref("templateSchemaFields"), $id: "templateSchemaResp" });
