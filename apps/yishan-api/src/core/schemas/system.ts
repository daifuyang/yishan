/**
 * 系统管理相关模式定义
 */

export const cleanupTokensReq = {
  $id: "cleanupTokensReq",
  type: "object",
  properties: {
    cron_token: {
      type: "string",
      description: "定时任务令牌，用于接口鉴权"
    },
    days_to_keep: {
      type: "integer",
      minimum: 1,
      maximum: 365,
      default: 30,
      description: "保留天数，默认30天"
    }
  },
  required: ["cron_token"]
} as const;

export const cleanupTokensResp = {
  $id: "cleanupTokensResp",
  type: "object",
  properties: {
    success: { type: "boolean" },
    code: { type: "number" },
    message: { type: "string" },
    timestamp: { type: "string" },
    data: {
      type: "object",
      properties: {
        deletedCount: {
          type: "integer",
          description: "物理删除的token数量"
        },
        revokedCount: {
          type: "integer",
          description: "撤销的过期token数量"
        },
        message: {
          type: "string",
          description: "清理结果描述"
        }
      }
    }
  }
} as const;

/**
 * Token 分类统计子结构（PAT 与 JWT access token 共用同一种口径）。
 * N6（FIX-api-validation-2026-07-24）：原 `total/active/expired/revoked` 字段
 * 实际统计口径混在一起，现拆分为 `apiTokens`（sys_api_token，PAT）和
 * `userTokens`（sys_user_token，JWT access token）两个子对象，每个子对象内
 * 仍是 total/active/expired/revoked 四数。
 */
export const tokenCategoryStats = {
  $id: "tokenCategoryStats",
  type: "object",
  properties: {
    total: { type: "integer", description: "总数（未软删）" },
    active: { type: "integer", description: "活跃数（未过期 / 未撤销）" },
    expired: { type: "integer", description: "过期数（未撤销但已过期）" },
    revoked: { type: "integer", description: "已撤销 / 已软删数" },
  },
  required: ["total", "active", "expired", "revoked"],
} as const;

export const tokenStatsResp = {
  $id: "tokenStatsResp",
  type: "object",
  properties: {
    success: { type: "boolean" },
    code: { type: "number" },
    message: { type: "string" },
    timestamp: { type: "string" },
    data: {
      type: "object",
      properties: {
        // === 新结构（N6 之后）：按 token 类型拆分 ===
        apiTokens: {
          $ref: "tokenCategoryStats#",
          description: "API Token (PAT, sys_api_token) 统计",
        },
        userTokens: {
          $ref: "tokenCategoryStats#",
          description: "用户登录 token (JWT access/refresh, sys_user_token) 统计",
        },
        // === 旧结构：保留以过渡（与 userTokens 同口径，但扁平）===
        totalTokens: {
          type: "integer",
          description: "@deprecated 请改用 userTokens.total；保留以兼容旧客户端",
          deprecated: true,
        },
        activeTokens: {
          type: "integer",
          description: "@deprecated 请改用 userTokens.active",
          deprecated: true,
        },
        expiredTokens: {
          type: "integer",
          description: "@deprecated 请改用 userTokens.expired",
          deprecated: true,
        },
        revokedTokens: {
          type: "integer",
          description: "@deprecated 请改用 userTokens.revoked",
          deprecated: true,
        },
      },
      // apiTokens / userTokens 是必填（旧字段保留以兼容，因此不强制）
      required: ["apiTokens", "userTokens"],
    },
  },
} as const;

// 系统参数键
export const systemOptionKey = {
  $id: "systemOptionKey",
  type: "string",
  description: "系统参数键"
} as const;

// 设置系统参数请求
export const setSystemOptionReq = {
  $id: "setSystemOptionReq",
  type: "object",
  properties: {
    value: { type: "string", description: "参数字符串" }
  },
  required: ["value"]
} as const;

// 获取系统参数响应
export const getSystemOptionResp = {
  $id: "getSystemOptionResp",
  type: "object",
  properties: {
    success: { type: "boolean" },
    code: { type: "number" },
    message: { type: "string" },
    timestamp: { type: "string" },
    data: { anyOf: [{ type: "string" }, { type: "null" }] }
  }
} as const;

// 批量设置项
export const systemOptionItem = {
  $id: "systemOptionItem",
  type: "object",
  properties: {
    key: { $ref: "systemOptionKey#" },
    value: { type: "string", description: "参数字符串（可为纯文本或JSON字符串）" }
  },
  required: ["key", "value"]
} as const;

// 批量设置请求
export const batchSetSystemOptionReq = {
  $id: "batchSetSystemOptionReq",
  type: "array",
  minItems: 1,
  items: { $ref: "systemOptionItem#" },
} as const;

// 批量设置响应
export const batchSetSystemOptionResp = {
  $id: "batchSetSystemOptionResp",
  type: "object",
  properties: {
    success: { type: "boolean" },
    code: { type: "number" },
    message: { type: "string" },
    timestamp: { type: "string" },
    data: {
      type: "object",
      properties: {
        updatedCount: { type: "integer" },
        results: {
          type: "array",
          items: {
            type: "object",
            properties: {
              key: { $ref: "systemOptionKey#" },
              value: { type: "string" },
              success: { type: "boolean" },
              code: { type: "number" },
              message: { type: "string" }
            }
          }
        }
      }
    }
  }
} as const;

// 批量获取请求
export const batchGetSystemOptionReq = {
  $id: "batchGetSystemOptionReq",
  type: "array",
  minItems: 1,
  items: { $ref: "systemOptionKey#" },
} as const;

// 批量获取响应
export const batchGetSystemOptionResp = {
  $id: "batchGetSystemOptionResp",
  type: "object",
  properties: {
    success: { type: "boolean" },
    code: { type: "number" },
    message: { type: "string" },
    timestamp: { type: "string" },
    data: {
      type: "object",
      properties: {
        results: {
          type: "array",
          items: {
            type: "object",
            properties: {
              key: { $ref: "systemOptionKey#" },
              value: { anyOf: [{ type: "string" }, { type: "null" }] }
            }
          }
        }
      }
    }
  }
} as const;

export const storageProvider = {
  $id: "storageProvider",
  type: "string",
  enum: ["disabled", "qiniu", "aliyunOss"],
  description: "云存储服务商",
} as const;

export const qiniuRegion = {
  $id: "qiniuRegion",
  type: "string",
  enum: ["z0", "z1", "z2", "na0", "as0"],
  description: "七牛云存储区域",
} as const;

export const qiniuConfigSchema = {
  $id: "qiniuConfigSchema",
  type: "object",
  properties: {
    provider: { type: "string", enum: ["qiniu"] },
    accessKey: { type: "string" },
    secretKey: { type: "string" },
    bucket: { type: "string" },
    region: { $ref: "qiniuRegion#" },
    domain: { type: "string" },
    useHttps: { type: "boolean" },
    useCdnDomains: { type: "boolean" },
    tokenExpires: { type: "integer" },
    callbackUrl: { type: "string" },
    uploadHost: { type: "string" },
  },
  additionalProperties: false,
} as const;

export const aliyunOssConfigSchema = {
  $id: "aliyunOssConfigSchema",
  type: "object",
  properties: {
    provider: { type: "string", enum: ["aliyunOss"] },
    accessKeyId: { type: "string" },
    accessKeySecret: { type: "string" },
    bucket: { type: "string" },
    region: { type: "string" },
    endpoint: { type: "string" },
    domain: { type: "string" },
    useHttps: { type: "boolean" },
  },
  additionalProperties: false,
} as const;

export const storageConfigSchema = {
  $id: "storageConfigSchema",
  type: "object",
  properties: {
    provider: { $ref: "storageProvider#" },
    qiniu: { $ref: "qiniuConfigSchema#" },
    aliyunOss: { $ref: "aliyunOssConfigSchema#" },
  },
  required: ["provider", "qiniu", "aliyunOss"],
  additionalProperties: false,
} as const;

export const getStorageConfigResp = {
  $id: "getStorageConfigResp",
  type: "object",
  properties: {
    success: { type: "boolean" },
    code: { type: "number" },
    message: { type: "string" },
    timestamp: { type: "string" },
    data: { $ref: "storageConfigSchema#" },
  },
} as const;

export const upsertStorageConfigReq = {
  $id: "upsertStorageConfigReq",
  type: "object",
  properties: {
    provider: { $ref: "storageProvider#" },
    qiniu: { $ref: "qiniuConfigSchema#" },
    aliyunOss: { $ref: "aliyunOssConfigSchema#" },
  },
  required: ["provider"],
  additionalProperties: false,
} as const;

export const upsertStorageConfigResp = {
  $id: "upsertStorageConfigResp",
  type: "object",
  properties: {
    success: { type: "boolean" },
    code: { type: "number" },
    message: { type: "string" },
    timestamp: { type: "string" },
    data: { $ref: "storageConfigSchema#" },
  },
} as const;

export const storageConfigExportPayload = {
  $id: "storageConfigExportPayload",
  type: "object",
  properties: {
    format: { type: "string" },
    version: { type: "integer" },
    exportedAt: { type: "string" },
    provider: { $ref: "storageProvider#" },
    qiniu: { $ref: "qiniuConfigSchema#" },
    aliyunOss: { $ref: "aliyunOssConfigSchema#" },
  },
  required: ["format", "version", "exportedAt", "provider"],
  additionalProperties: false,
} as const;

export const storageConfigExportResp = {
  $id: "storageConfigExportResp",
  type: "object",
  properties: {
    success: { type: "boolean" },
    code: { type: "number" },
    message: { type: "string" },
    timestamp: { type: "string" },
    data: { $ref: "storageConfigExportPayload#" },
  },
} as const;

export const storageConfigImportReq = {
  $id: "storageConfigImportReq",
  type: "object",
  properties: {
    provider: { $ref: "storageProvider#" },
    qiniu: { $ref: "qiniuConfigSchema#" },
    aliyunOss: { $ref: "aliyunOssConfigSchema#" },
    format: { type: "string" },
    version: { type: "integer" },
    exportedAt: { type: "string" },
  },
  required: ["provider"],
  additionalProperties: false,
} as const;

export const storageConfigImportResp = {
  $id: "storageConfigImportResp",
  type: "object",
  properties: {
    success: { type: "boolean" },
    code: { type: "number" },
    message: { type: "string" },
    timestamp: { type: "string" },
    data: {
      type: "object",
      properties: {
        provider: { $ref: "storageProvider#" },
      },
      required: ["provider"],
      additionalProperties: false,
    },
  },
} as const;

/**
 * 注册系统管理相关模式
 */
export default function registerSystem(fastify: any) {
  fastify.addSchema(cleanupTokensReq);
  fastify.addSchema(cleanupTokensResp);
  fastify.addSchema(tokenCategoryStats);
  fastify.addSchema(tokenStatsResp);
  fastify.addSchema(systemOptionKey);
  fastify.addSchema(setSystemOptionReq);
  fastify.addSchema(getSystemOptionResp);
  fastify.addSchema(systemOptionItem);
  fastify.addSchema(batchSetSystemOptionReq);
  fastify.addSchema(batchSetSystemOptionResp);
  fastify.addSchema(batchGetSystemOptionReq);
  fastify.addSchema(batchGetSystemOptionResp);
  fastify.addSchema(storageProvider);
  fastify.addSchema(qiniuRegion);
  fastify.addSchema(qiniuConfigSchema);
  fastify.addSchema(aliyunOssConfigSchema);
  fastify.addSchema(storageConfigSchema);
  fastify.addSchema(getStorageConfigResp);
  fastify.addSchema(upsertStorageConfigReq);
  fastify.addSchema(upsertStorageConfigResp);
  fastify.addSchema(storageConfigExportPayload);
  fastify.addSchema(storageConfigExportResp);
  fastify.addSchema(storageConfigImportReq);
  fastify.addSchema(storageConfigImportResp);
}

// Plugin management schemas (sysPlugin*, etc.) were removed together with
// `core/routes/api/v1/admin/system/plugins/` and the plugin-manage service.
// Module discovery is now driven by `apps/yishan-api/src/modules/` at boot.
