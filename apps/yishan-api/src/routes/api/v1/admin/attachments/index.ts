import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { Type } from "@sinclair/typebox";
import { ResponseUtil } from "../../../../../utils/response.js";
import { pipeline } from "stream/promises";
import { createWriteStream, promises as fs } from "fs";
import { extname, join } from "path";
import { randomUUID } from "crypto";
import { STORAGE_CONFIG } from "../../../../../config/index.js";

const adminAttachments: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
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
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            code: Type.Integer(),
            message: Type.String(),
            data: Type.Array(
              Type.Object({
                filename: Type.String(),
                originalName: Type.String(),
                mimeType: Type.String(),
                size: Type.Integer(),
                path: Type.String()
              })
            ),
            timestamp: Type.String({ format: "date-time" })
          })
        }
      }
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const uploadRoot = join(process.cwd(), STORAGE_CONFIG.uploadDir);
      await fs.mkdir(uploadRoot, { recursive: true });

      const results: Array<{ filename: string; originalName: string; mimeType: string; size: number; path: string }> = [];

      for await (const part of (request as any).parts()) {
        if (!part.file) continue;

        const originalName: string = part.filename || "file";
        const ext = extname(originalName) || "";
        const filename = `${randomUUID().replace(/-/g, "")}${ext}`;
        const filepath = join(uploadRoot, filename);

        await pipeline(part.file, createWriteStream(filepath));
        const stat = await fs.stat(filepath);

        results.push({
          filename,
          originalName,
          mimeType: part.mimetype,
          size: stat.size,
          path: `/${STORAGE_CONFIG.uploadDir}/${filename}`
        });
      }

      return ResponseUtil.success(reply, results, "上传成功");
    }
  );
};

export default adminAttachments;
