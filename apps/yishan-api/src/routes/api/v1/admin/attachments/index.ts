import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { Type } from "@sinclair/typebox";
import { ResponseUtil } from "../../../../../utils/response.js";
import { pipeline } from "stream/promises";
import { createWriteStream, promises as fs } from "fs";
import { extname, join } from "path";
import { randomUUID } from "crypto";
import { STORAGE_CONFIG } from "../../../../../config/index.js";
import {
  AttachmentFolderListQuery,
  AttachmentListQuery,
  CreateAttachmentFolderReq,
  UpdateAttachmentFolderReq,
  UpdateAttachmentReq,
} from "../../../../../schemas/attachment.js";
import { AttachmentService } from "../../../../../services/attachment.service.js";
import { AttachmentMessageKeys, getAttachmentMessage } from "../../../../../constants/messages/attachment.js";
import { AttachmentErrorCode } from "../../../../../constants/business-codes/attachment.js";
import { BusinessError } from "../../../../../exceptions/business-error.js";

const adminAttachments: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.get(
    "/folders",
    {
      schema: {
        summary: "获取分组列表",
        description: "分页获取素材分组列表，支持关键词、类型、状态与父级过滤",
        operationId: "getAttachmentFolderList",
        tags: ["attachments"],
        security: [{ bearerAuth: [] }],
        querystring: { $ref: "attachmentFolderListQuery#" },
        response: { 200: { $ref: "attachmentFolderListResp#" } },
      },
    },
    async (
      request: FastifyRequest<{ Querystring: AttachmentFolderListQuery }>,
      reply: FastifyReply
    ) => {
      const { page, pageSize } = request.query;
      const result = await AttachmentService.getFolderList(request.query);
      const message = getAttachmentMessage(
        AttachmentMessageKeys.FOLDER_LIST_SUCCESS,
        request.headers["accept-language"] as string
      );
      return ResponseUtil.paginated(reply, result.list, page, pageSize, result.total, message);
    }
  );

  fastify.get(
    "/folders/tree",
    {
      schema: {
        summary: "获取分组树",
        description: "获取素材分组树形结构（按 sort_order 排序）",
        operationId: "getAttachmentFolderTree",
        tags: ["attachments"],
        security: [{ bearerAuth: [] }],
        response: { 200: { $ref: "attachmentFolderTreeResp#" } },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tree = await AttachmentService.getFolderTree();
      const message = getAttachmentMessage(
        AttachmentMessageKeys.FOLDER_TREE_SUCCESS,
        request.headers["accept-language"] as string
      );
      return ResponseUtil.success(reply, tree, message);
    }
  );

  fastify.get(
    "/folders/:id",
    {
      schema: {
        summary: "获取分组详情",
        description: "根据分组ID获取分组详情",
        operationId: "getAttachmentFolderDetail",
        tags: ["attachments"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.Integer({ description: "分组ID", minimum: 1 }) }),
        response: { 200: { $ref: "attachmentFolderDetailResp#" } },
      },
    },
    async (request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) => {
      const folder = await AttachmentService.getFolderById(request.params.id);
      if (!folder) {
        throw new BusinessError(AttachmentErrorCode.FOLDER_NOT_FOUND, "分组不存在");
      }
      const message = getAttachmentMessage(
        AttachmentMessageKeys.FOLDER_DETAIL_SUCCESS,
        request.headers["accept-language"] as string
      );
      return ResponseUtil.success(reply, folder, message);
    }
  );

  fastify.post(
    "/folders",
    {
      schema: {
        summary: "创建分组",
        description: "创建一个新的素材分组",
        operationId: "createAttachmentFolder",
        tags: ["attachments"],
        security: [{ bearerAuth: [] }],
        body: { $ref: "createAttachmentFolderReq#" },
        response: { 200: { $ref: "attachmentFolderDetailResp#" } },
      },
    },
    async (request: FastifyRequest<{ Body: CreateAttachmentFolderReq }>, reply: FastifyReply) => {
      const folder = await AttachmentService.createFolder(request.body, request.currentUser.id);
      const message = getAttachmentMessage(
        AttachmentMessageKeys.FOLDER_CREATE_SUCCESS,
        request.headers["accept-language"] as string
      );
      return ResponseUtil.success(reply, folder, message);
    }
  );

  fastify.put(
    "/folders/:id",
    {
      schema: {
        summary: "更新分组",
        description: "根据分组ID更新分组信息",
        operationId: "updateAttachmentFolder",
        tags: ["attachments"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.Integer({ description: "分组ID", minimum: 1 }) }),
        body: { $ref: "updateAttachmentFolderReq#" },
        response: { 200: { $ref: "attachmentFolderDetailResp#" } },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: number }; Body: UpdateAttachmentFolderReq }>,
      reply: FastifyReply
    ) => {
      const folder = await AttachmentService.updateFolder(request.params.id, request.body, request.currentUser.id);
      const message = getAttachmentMessage(
        AttachmentMessageKeys.FOLDER_UPDATE_SUCCESS,
        request.headers["accept-language"] as string
      );
      return ResponseUtil.success(reply, folder, message);
    }
  );

  fastify.delete(
    "/folders/:id",
    {
      schema: {
        summary: "删除分组",
        description: "根据分组ID进行软删除，存在子分组或素材禁止删除",
        operationId: "deleteAttachmentFolder",
        tags: ["attachments"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.Integer({ description: "分组ID", minimum: 1 }) }),
        response: { 200: { $ref: "attachmentFolderDeleteResp#" } },
      },
    },
    async (request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) => {
      const result = await AttachmentService.deleteFolder(request.params.id, request.currentUser.id);
      const message = getAttachmentMessage(
        AttachmentMessageKeys.FOLDER_DELETE_SUCCESS,
        request.headers["accept-language"] as string
      );
      return ResponseUtil.success(reply, result, message);
    }
  );

  fastify.get(
    "/",
    {
      schema: {
        summary: "获取素材列表",
        description: "分页获取素材列表，支持关键词、类型、分组与状态筛选",
        operationId: "getAttachmentList",
        tags: ["attachments"],
        security: [{ bearerAuth: [] }],
        querystring: { $ref: "attachmentListQuery#" },
        response: { 200: { $ref: "attachmentListResp#" } },
      },
    },
    async (
      request: FastifyRequest<{ Querystring: AttachmentListQuery }>,
      reply: FastifyReply
    ) => {
      const { page, pageSize } = request.query;
      const result = await AttachmentService.getAttachmentList(request.query);
      const message = getAttachmentMessage(
        AttachmentMessageKeys.ATTACHMENT_LIST_SUCCESS,
        request.headers["accept-language"] as string
      );
      return ResponseUtil.paginated(reply, result.list, page, pageSize, result.total, message);
    }
  );

  fastify.get(
    "/:id",
    {
      schema: {
        summary: "获取素材详情",
        description: "根据素材ID获取素材详情",
        operationId: "getAttachmentDetail",
        tags: ["attachments"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.Integer({ description: "素材ID", minimum: 1 }) }),
        response: { 200: { $ref: "attachmentDetailResp#" } },
      },
    },
    async (request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) => {
      const a = await AttachmentService.getAttachmentById(request.params.id);
      if (!a) {
        throw new BusinessError(AttachmentErrorCode.ATTACHMENT_NOT_FOUND, "素材不存在");
      }
      const message = getAttachmentMessage(
        AttachmentMessageKeys.ATTACHMENT_DETAIL_SUCCESS,
        request.headers["accept-language"] as string
      );
      return ResponseUtil.success(reply, a, message);
    }
  );

  fastify.put(
    "/:id",
    {
      schema: {
        summary: "更新素材",
        description: "根据素材ID更新素材信息（名称、分组、状态、扩展信息）",
        operationId: "updateAttachment",
        tags: ["attachments"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.Integer({ description: "素材ID", minimum: 1 }) }),
        body: { $ref: "updateAttachmentReq#" },
        response: { 200: { $ref: "attachmentDetailResp#" } },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: number }; Body: UpdateAttachmentReq }>,
      reply: FastifyReply
    ) => {
      const a = await AttachmentService.updateAttachment(request.params.id, request.body, request.currentUser.id);
      const message = getAttachmentMessage(
        AttachmentMessageKeys.ATTACHMENT_UPDATE_SUCCESS,
        request.headers["accept-language"] as string
      );
      return ResponseUtil.success(reply, a, message);
    }
  );

  fastify.delete(
    "/:id",
    {
      schema: {
        summary: "删除素材",
        description: "根据素材ID进行软删除",
        operationId: "deleteAttachment",
        tags: ["attachments"],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.Integer({ description: "素材ID", minimum: 1 }) }),
        response: { 200: { $ref: "attachmentDeleteResp#" } },
      },
    },
    async (request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) => {
      const result = await AttachmentService.deleteAttachment(request.params.id, request.currentUser.id);
      const message = getAttachmentMessage(
        AttachmentMessageKeys.ATTACHMENT_DELETE_SUCCESS,
        request.headers["accept-language"] as string
      );
      return ResponseUtil.success(reply, result, message);
    }
  );

  fastify.post(
    "/",
    {
      schema: {
        summary: "上传附件",
        description: "支持批量上传的表单文件（multipart/form-data）",
        operationId: "uploadAttachments",
        tags: ["attachments"],
        security: [{ bearerAuth: [] }],
        consumes: ["multipart/form-data"],
        querystring: Type.Object({
          folderId: Type.Optional(Type.Integer({ description: "分组ID", minimum: 1 })),
          kind: Type.Optional(Type.String({ enum: ["image", "audio", "video", "other"], description: "素材类型" })),
          name: Type.Optional(Type.String({ description: "素材名称（批量上传时忽略）", maxLength: 255 })),
        }),
        response: { 200: { $ref: "uploadAttachmentsResp#" } },
      }
    },
    async (request: FastifyRequest<{ Querystring: { folderId?: number; kind?: "image" | "audio" | "video" | "other"; name?: string } }>, reply: FastifyReply) => {
      const uploadRoot = join(process.cwd(), STORAGE_CONFIG.uploadDir);
      await fs.mkdir(uploadRoot, { recursive: true });

      const uploadDirNormalized = STORAGE_CONFIG.uploadDir.replace(/\\/g, "/").replace(/^\/+/, "");
      const urlBase = uploadDirNormalized.startsWith("public/")
        ? `/${uploadDirNormalized.slice("public/".length)}`
        : `/${uploadDirNormalized}`;

      const results: Array<{ id?: number; filename: string; originalName: string; mimeType: string; size: number; path: string; kind?: string; url?: string }> = [];

      for await (const part of (request as any).parts()) {
        if (!part.file) continue;

        const originalName: string = part.filename || "file";
        const ext = extname(originalName) || "";
        const filename = `${randomUUID().replace(/-/g, "")}${ext}`;
        const filepath = join(uploadRoot, filename);

        await pipeline(part.file, createWriteStream(filepath));
        const stat = await fs.stat(filepath);

        const urlPath = `${urlBase}/${filename}`.replace(/\/+/g, "/");
        const created = await AttachmentService.createLocalAttachment(
          {
            folderId: request.query.folderId ?? null,
            kind: request.query.kind,
            name: request.query.name ?? null,
            originalName,
            filename,
            ext,
            mimeType: part.mimetype,
            size: stat.size,
            path: urlPath,
            url: urlPath,
          },
          request.currentUser.id
        );

        results.push({
          id: created.id,
          filename: created.filename,
          originalName: created.originalName,
          mimeType: created.mimeType,
          size: created.size,
          path: created.path || urlPath,
          kind: created.kind,
          url: created.url || urlPath,
        });
      }

      return ResponseUtil.success(reply, results, "上传成功");
    }
  );
};

export default adminAttachments;
