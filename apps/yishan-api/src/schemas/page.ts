import { Static, Type } from "@sinclair/typebox";
import { PaginationQuerySchema, successResponse } from "./common.js";
import { FastifyInstance } from "fastify";

const DynamicAttributesSchema = Type.Record(Type.String(), Type.Any(), { $id: "pageDynamicAttributes" });

const PortalPageSchema = Type.Object(
  {
    id: Type.Number({ description: "页面ID", example: 1 }),
    title: Type.String({ description: "页面标题", example: "关于我们" }),
    path: Type.String({ description: "页面路径（唯一）", example: "/about" }),
    content: Type.String({ description: "页面内容" }),
    status: Type.String({ enum: ["0", "1"], description: "状态（0-禁用，1-启用）", example: "1" }),
    publishTime: Type.Optional(Type.String({ format: "date-time", description: "发布时间" })),
    attributes: Type.Optional(Type.Ref("pageDynamicAttributes")),
    creatorId: Type.Optional(Type.Number({ description: "创建人Id" })),
    creatorName: Type.Optional(Type.String({ description: "创建人名称" })),
    createdAt: Type.String({ format: "date-time", description: "创建时间" }),
    updaterId: Type.Optional(Type.Number({ description: "更新人Id" })),
    updaterName: Type.Optional(Type.String({ description: "更新人名称" })),
    updatedAt: Type.String({ format: "date-time", description: "更新时间" }),
  },
  { $id: "portalPage" }
);

export type PortalPageResp = Static<typeof PortalPageSchema>;


const CreatePageReqSchema = Type.Object(
  {
    title: Type.String({ description: "页面标题", minLength: 1, maxLength: 200 }),
    path: Type.String({ description: "页面路径（唯一）", minLength: 1, maxLength: 255 }),
    content: Type.String({ description: "页面内容" }),
    status: Type.Optional(Type.String({ enum: ["0", "1"], description: "状态", default: "1" })),
    publishTime: Type.Optional(Type.String({ format: "date-time", description: "发布时间" })),
    attributes: Type.Optional(Type.Ref("pageDynamicAttributes")),
  },
  { $id: "createPageReq" }
);


const UpdatePageReqSchema = Type.Partial(CreatePageReqSchema, { $id: "updatePageReq", minProperties: 1 });

export type CreatePageReq = Static<typeof CreatePageReqSchema>;
export type UpdatePageReq = Static<typeof UpdatePageReqSchema>;


const PageListQuerySchema = Type.Object(
  {
    ...PaginationQuerySchema.properties,
    keyword: Type.Optional(Type.String({ description: "搜索关键词（标题、路径）" })),
    status: Type.Optional(Type.String({ enum: ["0", "1"], description: "状态" })),
    sortBy: Type.Optional(Type.String({ enum: ["createdAt", "updatedAt", "publishTime"], default: "createdAt" })),
    sortOrder: Type.Optional(Type.String({ enum: ["asc", "desc"], default: "desc" })),
  },
  { $id: "pageListQuery" }
);

export type PageListQuery = Static<typeof PageListQuerySchema>;


const PageListRespSchema = successResponse({ data: Type.Array(Type.Ref("portalPage")), $id: "pageListResp", includePagination: true });
const PageDetailRespSchema = successResponse({ data: Type.Ref("portalPage"), $id: "pageDetailResp" });
const PageDeleteRespSchema = successResponse({ data: Type.Object({ id: Type.Number({ description: "页面ID" }) }), $id: "pageDeleteResp", message: "删除成功" });

const registerPageSchemas = (fastify: FastifyInstance) => {
  fastify.addSchema(DynamicAttributesSchema);
  fastify.addSchema(PortalPageSchema);
  fastify.addSchema(CreatePageReqSchema);
  fastify.addSchema(UpdatePageReqSchema);
  fastify.addSchema(PageListQuerySchema);
  fastify.addSchema(PageListRespSchema);
  fastify.addSchema(PageDetailRespSchema);
  fastify.addSchema(PageDeleteRespSchema);
};

export default registerPageSchemas;
