import { Static, Type } from "@sinclair/typebox";
import { PaginationQuerySchema, successResponse } from "./common.js";
import { FastifyInstance } from "fastify";

const DynamicAttributesSchema = Type.Record(Type.String(), Type.Any(), { $id: "dynamicAttributes" });

const PortalCategorySchema = Type.Object(
  {
    id: Type.Number({ description: "分类ID", example: 1 }),
    name: Type.String({ description: "分类名称", example: "新闻" }),
    slug: Type.Optional(Type.String({ description: "URL标识", example: "news" })),
    parentId: Type.Optional(Type.Number({ description: "父级分类ID", example: 0 })),
    parentName: Type.Optional(Type.String({ description: "父级分类名称", example: "根分类" })),
    status: Type.String({ enum: ["0", "1"], description: "状态（0-禁用，1-启用）", example: "1" }),
    sort_order: Type.Number({ description: "排序序号", example: 10 }),
    description: Type.Optional(Type.String({ description: "分类描述", example: "门户文章分类" })),
    creatorId: Type.Optional(Type.Number({ description: "创建人Id", example: 1 })),
    creatorName: Type.Optional(Type.String({ description: "创建人名称", example: "admin" })),
    createdAt: Type.String({ format: "date-time", description: "创建时间" }),
    updaterId: Type.Optional(Type.Number({ description: "更新人Id", example: 1 })),
    updaterName: Type.Optional(Type.String({ description: "更新人名称", example: "admin" })),
    updatedAt: Type.String({ format: "date-time", description: "更新时间" }),
  },
  { $id: "portalCategory" }
);

export type PortalCategoryResp = Static<typeof PortalCategorySchema>;


const PortalArticleSchema = Type.Object(
  {
    id: Type.Number({ description: "文章ID", example: 1 }),
    title: Type.String({ description: "标题", example: "欢迎使用门户" }),
    slug: Type.Optional(Type.String({ description: "URL标识", example: "welcome" })),
    summary: Type.Optional(Type.String({ description: "摘要", maxLength: 500 })),
    content: Type.String({ description: "正文内容" }),
    coverImage: Type.Optional(Type.String({ description: "封面图URL" })),
    status: Type.String({ enum: ["0", "1"], description: "状态（0-草稿，1-已发布）", example: "0" }),
    isPinned: Type.Optional(Type.Boolean({ description: "是否置顶", default: false })),
    publishTime: Type.Optional(Type.String({ format: "date-time", description: "发布时间" })),
    tags: Type.Optional(Type.Array(Type.String(), { description: "标签" })),
    attributes: Type.Optional(Type.Ref("dynamicAttributes")),
    templateId: Type.Optional(Type.Number({ description: "模板ID" })),
    templateName: Type.Optional(Type.String({ description: "模板名称" })),
    templateSchema: Type.Optional(Type.Ref("templateSchemaFields")),
    categoryIds: Type.Optional(Type.Array(Type.Number(), { description: "所属分类ID列表" })),
    creatorId: Type.Optional(Type.Number({ description: "创建人Id" })),
    creatorName: Type.Optional(Type.String({ description: "创建人名称" })),
    createdAt: Type.String({ format: "date-time", description: "创建时间" }),
    updaterId: Type.Optional(Type.Number({ description: "更新人Id" })),
    updaterName: Type.Optional(Type.String({ description: "更新人名称" })),
    updatedAt: Type.String({ format: "date-time", description: "更新时间" }),
  },
  { $id: "portalArticle" }
);

export type PortalArticleResp = Static<typeof PortalArticleSchema>;


const CreateArticleReqSchema = Type.Object(
  {
    title: Type.String({ description: "标题", minLength: 1, maxLength: 200 }),
    slug: Type.Optional(Type.String({ description: "URL标识", maxLength: 200 })),
    summary: Type.Optional(Type.String({ description: "摘要", maxLength: 500 })),
    content: Type.String({ description: "正文内容" }),
    coverImage: Type.Optional(Type.String({ description: "封面图URL" })),
    status: Type.Optional(
      Type.String({ enum: ["0", "1"], description: "状态（0-草稿，1-已发布）", default: "0" })
    ),
    isPinned: Type.Optional(Type.Boolean({ description: "是否置顶", default: false })),
    publishTime: Type.Optional(Type.String({ format: "date-time", description: "发布时间" })),
    tags: Type.Optional(Type.Array(Type.String(), { description: "标签" })),
    attributes: Type.Optional(Type.Ref("dynamicAttributes")),
    templateId: Type.Optional(Type.Number({ description: "模板ID" })),
    categoryIds: Type.Optional(Type.Array(Type.Number(), { description: "分类ID列表" })),
  },
  { $id: "createArticleReq" }
);


const UpdateArticleReqSchema = Type.Partial(CreateArticleReqSchema, {
  $id: "updateArticleReq",
  minProperties: 1,
});

export type CreateArticleReq = Static<typeof CreateArticleReqSchema>;
export type UpdateArticleReq = Static<typeof UpdateArticleReqSchema>;


const ArticleListQuerySchema = Type.Object(
  {
    ...PaginationQuerySchema.properties,
    keyword: Type.Optional(Type.String({ description: "搜索关键词（标题、摘要、内容）" })),
    status: Type.Optional(Type.String({ enum: ["0", "1"], description: "状态" })),
    categoryId: Type.Optional(Type.Number({ description: "分类ID过滤" })),
    startTime: Type.Optional(Type.String({ format: "date-time", description: "开始时间" })),
    endTime: Type.Optional(Type.String({ format: "date-time", description: "结束时间" })),
    sortBy: Type.Optional(Type.String({
      enum: ["createdAt", "updatedAt", "publishTime"],
      default: "createdAt",
      description: "排序字段",
    })),
    sortOrder: Type.Optional(Type.String({ enum: ["asc", "desc"], default: "desc", description: "排序方向" })),
  },
  { $id: "articleListQuery" }
);

export type ArticleListQuery = Static<typeof ArticleListQuerySchema>;


const SaveCategoryReqSchema = Type.Object(
  {
    name: Type.String({ description: "分类名称", minLength: 1, maxLength: 100 }),
    slug: Type.Optional(Type.String({ description: "URL标识", maxLength: 100 })),
    parentId: Type.Optional(Type.Number({ description: "父级分类ID" })),
    status: Type.Optional(Type.String({ enum: ["0", "1"], description: "状态", default: "1" })),
    sort_order: Type.Optional(Type.Number({ description: "排序序号", default: 0 })),
    description: Type.Optional(Type.String({ description: "分类描述", maxLength: 255 })),
  },
  { $id: "saveCategoryReq" }
);

const UpdateCategoryReqSchema = Type.Partial(SaveCategoryReqSchema, { $id: "updateCategoryReq", minProperties: 1 });

export type SaveCategoryReq = Static<typeof SaveCategoryReqSchema>;
export type UpdateCategoryReq = Static<typeof UpdateCategoryReqSchema>;


const CategoryListQuerySchema = Type.Object(
  {
    ...PaginationQuerySchema.properties,
    keyword: Type.Optional(Type.String({ description: "搜索关键词（名称、描述）" })),
    status: Type.Optional(Type.String({ enum: ["0", "1"], description: "状态" })),
    parentId: Type.Optional(Type.Number({ description: "父级分类ID" })),
    sortBy: Type.Optional(Type.String({ enum: ["sort_order", "createdAt", "updatedAt"], default: "sort_order" })),
    sortOrder: Type.Optional(Type.String({ enum: ["asc", "desc"], default: "asc" })),
  },
  { $id: "categoryListQuery" }
);

export type CategoryListQuery = Static<typeof CategoryListQuerySchema>;


const ArticleListRespSchema = successResponse({ data: Type.Array(Type.Ref("portalArticle")), $id: "articleListResp", includePagination: true });
const ArticleDetailRespSchema = successResponse({ data: Type.Ref("portalArticle"), $id: "articleDetailResp" });
const ArticleDeleteRespSchema = successResponse({ data: Type.Object({ id: Type.Number({ description: "文章ID" }) }), $id: "articleDeleteResp", message: "删除成功" });

const CategoryListRespSchema = successResponse({ data: Type.Array(Type.Ref("portalCategory")), $id: "categoryListResp", includePagination: true });
const CategoryDetailRespSchema = successResponse({ data: Type.Ref("portalCategory"), $id: "categoryDetailResp" });
const CategoryDeleteRespSchema = successResponse({ data: Type.Object({ id: Type.Number({ description: "分类ID" }) }), $id: "categoryDeleteResp", message: "删除成功" });

const registerArticleSchemas = (fastify: FastifyInstance) => {
  fastify.addSchema(DynamicAttributesSchema);
  fastify.addSchema(PortalCategorySchema);
  fastify.addSchema(PortalArticleSchema);
  fastify.addSchema(CreateArticleReqSchema);
  fastify.addSchema(UpdateArticleReqSchema);
  fastify.addSchema(ArticleListQuerySchema);
  fastify.addSchema(ArticleListRespSchema);
  fastify.addSchema(ArticleDetailRespSchema);
  fastify.addSchema(ArticleDeleteRespSchema);
  fastify.addSchema(SaveCategoryReqSchema);
  fastify.addSchema(UpdateCategoryReqSchema);
  fastify.addSchema(CategoryListQuerySchema);
  fastify.addSchema(CategoryListRespSchema);
  fastify.addSchema(CategoryDetailRespSchema);
  fastify.addSchema(CategoryDeleteRespSchema);
};

export default registerArticleSchemas;
