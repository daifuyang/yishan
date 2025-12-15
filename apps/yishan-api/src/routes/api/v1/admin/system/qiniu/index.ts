import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { Type } from "@sinclair/typebox";
import { ResponseUtil } from "../../../../../../utils/response.js";
import { QINIU_CONFIG } from "../../../../../../config/index.js";
import qiniu from "qiniu";
import { ValidationErrorCode } from "../../../../../../constants/business-codes/validation.js";
import { BusinessError } from "../../../../../../exceptions/business-error.js";

// 使用官方 SDK 生成上传凭证

const adminQiniu: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.get(
    "/token",
    {
      schema: {
        summary: "获取七牛云上传临时凭证",
        description: "根据七牛云官方文档生成上传凭证（uptoken）",
        operationId: "getQiniuUploadToken",
        tags: ["system"],
        security: [{ bearerAuth: [] }],
        querystring: Type.Object({
          scopeKey: Type.Optional(Type.String({ description: "可选：指定对象键（bucket:key），默认仅 bucket" })),
          expiresIn: Type.Optional(Type.Integer({ description: "凭证有效期（秒），默认配置值" })),
        }),
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            code: Type.Integer(),
            message: Type.String(),
            data: Type.Object({
              token: Type.String(),
              bucket: Type.String(),
              scope: Type.String(),
              deadline: Type.Integer(),
              expiresIn: Type.Integer(),
              uploadUrl: Type.Optional(Type.String()),
            }),
            timestamp: Type.String({ format: "date-time" })
          })
        }
      }
    },
    async (request: FastifyRequest<{ Querystring: { scopeKey?: string; expiresIn?: number } }>, reply: FastifyReply) => {
      const { accessKey, secretKey, bucket } = QINIU_CONFIG;
      if (!accessKey || !secretKey || !bucket) {
        throw new BusinessError(
          ValidationErrorCode.INVALID_PARAMETER,
          "七牛云配置缺失，请设置 QINIU_AK、QINIU_SK、QINIU_BUCKET"
        );
      }

      const expiresIn = request.query.expiresIn && request.query.expiresIn > 0
        ? request.query.expiresIn
        : QINIU_CONFIG.expiresIn;

      const deadline = Math.floor(Date.now() / 1000) + expiresIn;
      const scope = request.query.scopeKey ? `${bucket}:${request.query.scopeKey}` : bucket;

      const mac = new qiniu.auth.digest.Mac(accessKey, secretKey);
      const putPolicy = new qiniu.rs.PutPolicy({ scope, expires: expiresIn });
      const token = putPolicy.uploadToken(mac);

      return ResponseUtil.success(reply, {
        token,
        bucket,
        scope,
        deadline,
        expiresIn,
        uploadUrl: QINIU_CONFIG.uploadUrl || undefined,
      }, "获取成功");
    }
  );
};

export default adminQiniu;
