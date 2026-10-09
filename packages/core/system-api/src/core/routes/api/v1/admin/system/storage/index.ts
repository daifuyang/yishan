import { createRouteRegistrar } from '@yishan/core-api/routes/route-registrar';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { ResponseUtil } from "@yishan/core-api/response";
import { getSystemMessage, SystemMessageKeys } from "../../../../../../../constants/messages/system.js";
import { StorageConfigService } from "../../../../../../services/storage-config.service.js";
import { registerRoutePermissions as registerPermissions } from '@/route-permissions'
import type { PermissionRef } from '@yishan/core-api/permissions/catalog';

const PERMS: { readonly [k: string]: PermissionRef } = Object.freeze({
  LIST:   { code: 'system:storage:list',   label: '存储管理-列表', group: 'system' },
  UPDATE: { code: 'system:storage:update', label: '存储管理-更新', group: 'system' },
});

const adminSystemStorage: FastifyPluginAsync = async (fastify): Promise<void> => {
  registerPermissions(...Object.values(PERMS));
  const route = createRouteRegistrar(fastify);
  route.get(
    "/config",
    {
      access: { permission: PERMS.LIST },
      schema: {
        summary: "获取云存储配置",
        description: "获取当前云存储配置（用于后台配置页面展示）",
        operationId: "getStorageConfig",
        tags: ["storage"],
        security: [{ bearerAuth: [] }],
        response: { 200: { $ref: "getStorageConfigResp#" } },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const cfg = await StorageConfigService.getConfig();
      const message = getSystemMessage(
        SystemMessageKeys.SYSTEM_OPTION_GET_SUCCESS,
        request.headers["accept-language"] as string
      );
      return ResponseUtil.success(reply, cfg, message);
    }
  );

  route.put(
    "/config",
    {
      access: { permission: PERMS.UPDATE },
      schema: {
        summary: "新增/更新云存储配置",
        description: "新增或覆盖当前云存储配置（固定写入 systemStorage/qiniuConfig/aliyunOssConfig）",
        operationId: "upsertStorageConfig",
        tags: ["storage"],
        security: [{ bearerAuth: [] }],
        body: { $ref: "upsertStorageConfigReq#" },
        response: { 200: { $ref: "upsertStorageConfigResp#" } },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = (request.body || {}) as any;
      const cfg = await StorageConfigService.upsertConfig(
        {
          provider: body.provider,
          qiniu: body.qiniu,
          aliyunOss: body.aliyunOss,
        },
        request.currentUser.id
      );
      const message = getSystemMessage(
        SystemMessageKeys.SYSTEM_OPTION_SET_SUCCESS,
        request.headers["accept-language"] as string
      );
      return ResponseUtil.success(reply, cfg, message);
    }
  );

  route.get(
    "/export",
    {
      access: { permission: PERMS.LIST },
      schema: {
        summary: "导出云存储配置",
        description: "导出当前云存储配置（不包含 SecretKey 等敏感信息）",
        operationId: "exportStorageConfig",
        tags: ["storage"],
        security: [{ bearerAuth: [] }],
        response: { 200: { $ref: "storageConfigExportResp#" } },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const payload = await StorageConfigService.exportConfig();
      const message = getSystemMessage(
        SystemMessageKeys.SYSTEM_OPTION_GET_SUCCESS,
        request.headers["accept-language"] as string
      );

      return ResponseUtil.success(
        reply,
        payload,
        message
      );
    }
  );

  route.post(
    "/import",
    {
      access: { permission: PERMS.UPDATE },
      schema: {
        summary: "导入云存储配置",
        description: "导入云存储配置（会覆盖当前配置）",
        operationId: "importStorageConfig",
        tags: ["storage"],
        security: [{ bearerAuth: [] }],
        body: { $ref: "storageConfigImportReq#" },
        response: { 200: { $ref: "storageConfigImportResp#" } },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = (request.body || {}) as any;
      const userId = request.currentUser.id;
      const result = await StorageConfigService.importConfig(
        {
          provider: body.provider,
          qiniu: body.qiniu,
          aliyunOss: body.aliyunOss,
        },
        userId
      );

      const message = getSystemMessage(
        SystemMessageKeys.SYSTEM_OPTION_SET_SUCCESS,
        request.headers["accept-language"] as string
      );
      return ResponseUtil.success(reply, result, message);
    }
  );
};

export default adminSystemStorage;
