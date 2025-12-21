import { Static, Type } from "@sinclair/typebox";
import { FastifyInstance } from "fastify";
import { PaginationQuerySchema, successResponse } from "./common.js";

const AttachmentKindSchema = Type.String({
  enum: ["image", "audio", "video", "other"],
  description: "素材类型",
});

const AttachmentFolderKindSchema = Type.String({
  enum: ["all", "image", "audio", "video", "other"],
  description: "分组类型",
});

const SysAttachmentFolderSchema = Type.Object(
  {
    id: Type.Number({ description: "分组ID", example: 1 }),
    name: Type.String({ description: "分组名称", example: "默认分组" }),
    parentId: Type.Optional(Type.Number({ description: "父分组ID", example: 0 })),
    kind: AttachmentFolderKindSchema,
    status: Type.String({ enum: ["0", "1"], description: "状态（0-禁用，1-启用）", example: "1" }),
    sort_order: Type.Number({ description: "排序序号", example: 0 }),
    remark: Type.Optional(Type.String({ description: "备注", example: "用于存放图片素材" })),
    creatorId: Type.Optional(Type.Number({ description: "创建人Id", example: 1 })),
    creatorName: Type.Optional(Type.String({ description: "创建人名称", example: "admin" })),
    createdAt: Type.String({ format: "date-time", description: "创建时间" }),
    updaterId: Type.Optional(Type.Number({ description: "更新人Id", example: 1 })),
    updaterName: Type.Optional(Type.String({ description: "更新人名称", example: "admin" })),
    updatedAt: Type.String({ format: "date-time", description: "更新时间" }),
    children: Type.Optional(Type.Array(Type.Ref("sysAttachmentFolder"))),
  },
  { $id: "sysAttachmentFolder" }
);

export type SysAttachmentFolderResp = Static<typeof SysAttachmentFolderSchema>;

const CreateAttachmentFolderReqSchema = Type.Object(
  {
    name: Type.String({ description: "分组名称", minLength: 1, maxLength: 100 }),
    parentId: Type.Optional(Type.Number({ description: "父分组ID" })),
    kind: Type.Optional(AttachmentFolderKindSchema),
    status: Type.Optional(Type.String({ enum: ["0", "1"], default: "1", description: "状态" })),
    sort_order: Type.Optional(Type.Number({ description: "排序序号", default: 0 })),
    remark: Type.Optional(Type.String({ description: "备注", maxLength: 255 })),
  },
  { $id: "createAttachmentFolderReq" }
);

const UpdateAttachmentFolderReqSchema = Type.Partial(CreateAttachmentFolderReqSchema, {
  $id: "updateAttachmentFolderReq",
  minProperties: 1,
});

export type CreateAttachmentFolderReq = Static<typeof CreateAttachmentFolderReqSchema>;
export type UpdateAttachmentFolderReq = Static<typeof UpdateAttachmentFolderReqSchema>;

const AttachmentFolderListQuerySchema = Type.Object(
  {
    ...PaginationQuerySchema.properties,
    keyword: Type.Optional(Type.String({ description: "搜索关键词（名称）" })),
    kind: Type.Optional(AttachmentFolderKindSchema),
    status: Type.Optional(Type.String({ enum: ["0", "1"], description: "状态" })),
    parentId: Type.Optional(Type.Number({ description: "父分组ID过滤" })),
    sortBy: Type.Optional(Type.String({ enum: ["sort_order", "createdAt", "updatedAt"], default: "sort_order" })),
    sortOrder: Type.Optional(Type.String({ enum: ["asc", "desc"], default: "asc" })),
  },
  { $id: "attachmentFolderListQuery" }
);

export type AttachmentFolderListQuery = Static<typeof AttachmentFolderListQuerySchema>;

const AttachmentFolderListRespSchema = successResponse({
  data: Type.Array(Type.Ref("sysAttachmentFolder")),
  $id: "attachmentFolderListResp",
  includePagination: true,
});

const AttachmentFolderDetailRespSchema = successResponse({
  data: Type.Ref("sysAttachmentFolder"),
  $id: "attachmentFolderDetailResp",
});

const AttachmentFolderTreeRespSchema = successResponse({
  data: Type.Array(Type.Ref("sysAttachmentFolder")),
  $id: "attachmentFolderTreeResp",
});

const AttachmentFolderDeleteRespSchema = successResponse({
  data: Type.Object({ id: Type.Number({ description: "分组ID" }) }),
  $id: "attachmentFolderDeleteResp",
  message: "删除成功",
});

const SysAttachmentSchema = Type.Object(
  {
    id: Type.Number({ description: "素材ID", example: 1 }),
    folderId: Type.Optional(Type.Number({ description: "分组ID", example: 1 })),
    folderName: Type.Optional(Type.String({ description: "分组名称", example: "默认分组" })),
    kind: AttachmentKindSchema,
    name: Type.Optional(Type.String({ description: "素材名称", example: "封面图" })),
    originalName: Type.String({ description: "原始文件名", example: "cover.png" }),
    filename: Type.String({ description: "存储文件名", example: "a1b2c3.png" }),
    ext: Type.Optional(Type.String({ description: "扩展名", example: "png" })),
    mimeType: Type.String({ description: "MIME 类型", example: "image/png" }),
    size: Type.Number({ description: "文件大小（字节）", example: 1024 }),
    storage: Type.String({ description: "存储类型", example: "local" }),
    path: Type.Optional(Type.String({ description: "本地路径", example: "/uploads/a1b2c3.png" })),
    url: Type.Optional(Type.String({ description: "可访问URL", example: "https://cdn.example.com/a1b2c3.png" })),
    objectKey: Type.Optional(Type.String({ description: "对象存储Key", example: "uploads/2025/cover.png" })),
    hash: Type.Optional(Type.String({ description: "内容哈希", example: "md5..." })),
    width: Type.Optional(Type.Number({ description: "图片宽度" })),
    height: Type.Optional(Type.Number({ description: "图片高度" })),
    duration: Type.Optional(Type.Number({ description: "音视频时长（秒）" })),
    metadata: Type.Optional(Type.Any({ description: "扩展信息" })),
    status: Type.String({ enum: ["0", "1"], description: "状态（0-禁用，1-启用）", example: "1" }),
    creatorId: Type.Optional(Type.Number({ description: "创建人Id", example: 1 })),
    creatorName: Type.Optional(Type.String({ description: "创建人名称", example: "admin" })),
    createdAt: Type.String({ format: "date-time", description: "创建时间" }),
    updaterId: Type.Optional(Type.Number({ description: "更新人Id", example: 1 })),
    updaterName: Type.Optional(Type.String({ description: "更新人名称", example: "admin" })),
    updatedAt: Type.String({ format: "date-time", description: "更新时间" }),
  },
  { $id: "sysAttachment" }
);

export type SysAttachmentResp = Static<typeof SysAttachmentSchema>;

const AttachmentListQuerySchema = Type.Object(
  {
    ...PaginationQuerySchema.properties,
    keyword: Type.Optional(Type.String({ description: "搜索关键词（名称/原始文件名）" })),
    kind: Type.Optional(AttachmentKindSchema),
    folderId: Type.Optional(Type.Number({ description: "分组ID过滤" })),
    mimeType: Type.Optional(Type.String({ description: "MIME 类型过滤" })),
    storage: Type.Optional(Type.String({ description: "存储类型过滤" })),
    status: Type.Optional(Type.String({ enum: ["0", "1"], description: "状态" })),
    sortBy: Type.Optional(Type.String({ enum: ["createdAt", "size", "updatedAt"], default: "createdAt" })),
    sortOrder: Type.Optional(Type.String({ enum: ["asc", "desc"], default: "desc" })),
  },
  { $id: "attachmentListQuery" }
);

export type AttachmentListQuery = Static<typeof AttachmentListQuerySchema>;

const AttachmentListRespSchema = successResponse({
  data: Type.Array(Type.Ref("sysAttachment")),
  $id: "attachmentListResp",
  includePagination: true,
});

const AttachmentDetailRespSchema = successResponse({
  data: Type.Ref("sysAttachment"),
  $id: "attachmentDetailResp",
});

const UpdateAttachmentReqSchema = Type.Object(
  {
    name: Type.Optional(Type.String({ description: "素材名称", maxLength: 255 })),
    folderId: Type.Optional(Type.Union([Type.Number({ description: "分组ID" }), Type.Null()])),
    status: Type.Optional(Type.String({ enum: ["0", "1"], description: "状态" })),
    metadata: Type.Optional(Type.Any({ description: "扩展信息" })),
  },
  { $id: "updateAttachmentReq" }
);

export type UpdateAttachmentReq = Static<typeof UpdateAttachmentReqSchema>;

const AttachmentDeleteRespSchema = successResponse({
  data: Type.Object({ id: Type.Number({ description: "素材ID" }) }),
  $id: "attachmentDeleteResp",
  message: "删除成功",
});

const AttachmentBatchDeleteReqSchema = Type.Object(
  {
    ids: Type.Array(Type.Integer({ minimum: 1 }), { minItems: 1, description: "素材ID列表" }),
  },
  { $id: "attachmentBatchDeleteReq" }
);

const AttachmentBatchDeleteRespSchema = successResponse({
  data: Type.Object({
    ids: Type.Array(Type.Number({ description: "已删除的素材ID列表" })),
  }),
  $id: "attachmentBatchDeleteResp",
  message: "删除成功",
});

const UploadAttachmentItemSchema = Type.Object({
  id: Type.Optional(Type.Number({ description: "素材ID" })),
  filename: Type.String(),
  originalName: Type.String(),
  mimeType: Type.String(),
  size: Type.Integer(),
  path: Type.String(),
  kind: Type.Optional(AttachmentKindSchema),
  url: Type.Optional(Type.String()),
});

const UploadAttachmentsRespSchema = successResponse({
  data: Type.Array(UploadAttachmentItemSchema),
  $id: "uploadAttachmentsResp",
  message: "上传成功",
});

const registerAttachment = (fastify: FastifyInstance) => {
  fastify.addSchema(SysAttachmentFolderSchema);
  fastify.addSchema(CreateAttachmentFolderReqSchema);
  fastify.addSchema(UpdateAttachmentFolderReqSchema);
  fastify.addSchema(AttachmentFolderListQuerySchema);
  fastify.addSchema(AttachmentFolderListRespSchema);
  fastify.addSchema(AttachmentFolderDetailRespSchema);
  fastify.addSchema(AttachmentFolderTreeRespSchema);
  fastify.addSchema(AttachmentFolderDeleteRespSchema);

  fastify.addSchema(SysAttachmentSchema);
  fastify.addSchema(AttachmentListQuerySchema);
  fastify.addSchema(AttachmentListRespSchema);
  fastify.addSchema(AttachmentDetailRespSchema);
  fastify.addSchema(UpdateAttachmentReqSchema);
  fastify.addSchema(AttachmentDeleteRespSchema);
  fastify.addSchema(AttachmentBatchDeleteReqSchema);
  fastify.addSchema(AttachmentBatchDeleteRespSchema);
  fastify.addSchema(UploadAttachmentsRespSchema);
};

export default registerAttachment;
