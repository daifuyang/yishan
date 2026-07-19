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
        totalTokens: {
          type: "integer",
          description: "总token数量"
        },
        activeTokens: {
          type: "integer",
          description: "活跃token数量"
        },
        expiredTokens: {
          type: "integer",
          description: "过期token数量"
        },
        revokedTokens: {
          type: "integer",
          description: "已撤销token数量"
        }
      }
    }
  }
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
  fastify.addSchema(sysPluginConflictDetail);
  fastify.addSchema(sysPluginSyncStatus);
  fastify.addSchema(sysPlugin);
  fastify.addSchema(sysPluginHookReport);
  fastify.addSchema(sysPluginSyncLog);
  fastify.addSchema(sysPluginResp);
  fastify.addSchema(sysPluginListResp);
  fastify.addSchema(sysPluginSyncLogListResp);
  fastify.addSchema(sysPluginHookReportListResp);
  fastify.addSchema(sysPluginListQuery);
  fastify.addSchema(sysPluginSyncLogQuery);
  fastify.addSchema(sysPluginHookReportQuery);
  fastify.addSchema(sysPluginEnableQuery);
  fastify.addSchema(sysPluginSyncQuery);
}

// ============================================================================
// 插件管理 schemas
// ----------------------------------------------------------------------------
// 这些 schema 描述 `apps/yishan-api/src/core/routes/api/v1/admin/system/plugins/`
// 下 7 个路由的 querystring 与响应载荷；它们存在的原因只有一个：
// 让 OpenAPI 生成器把 SysPlugin / SysPluginHookReport / SysPluginSyncLog 等
// 类型写入 admin 的 services/generated，page 端不再手动声明接口。
// ============================================================================

export const sysPluginConflictDetail = {
  $id: "sysPluginConflictDetail",
  type: "object",
  description: "菜单同步冲突详情（plugin-menu-sync.service.ts → ConflictDetail）",
  properties: {
    path: { type: "string", description: "冲突的菜单路径" },
    name: { type: "string", description: "冲突的菜单名" },
    existingPluginName: { type: "string", description: "占用该路径的已有插件名" },
    reason: { type: "string", description: "冲突原因描述" },
  },
  required: ["path", "existingPluginName", "reason"],
} as const;

export const sysPluginSyncStatus = {
  $id: "sysPluginSyncStatus",
  type: "object",
  description: "最近一次菜单同步结果（plugin-manage.service.ts → PluginSyncStatus）",
  properties: {
    strategy: { type: "string", enum: ["strict", "safe"] },
    status: { type: "string", enum: ["success", "partial", "failed"] },
    created: { type: "integer", description: "新增菜单数" },
    updated: { type: "integer", description: "更新菜单数" },
    skipped: { type: "integer", description: "跳过菜单数" },
    conflicted: { type: "integer", description: "冲突菜单数" },
    conflictDetails: {
      type: "array",
      items: { $ref: "sysPluginConflictDetail#" },
    },
    lastSyncAt: { type: "string", description: "ISO 时间戳" },
  },
  required: ["strategy", "status", "created", "updated", "skipped", "conflicted", "conflictDetails"],
} as const;

export const sysPlugin = {
  $id: "sysPlugin",
  type: "object",
  description: "插件管理列表项（plugin-manage.service.ts → PluginManageItem）",
  properties: {
    pluginId: { type: "string", description: "插件唯一 ID" },
    name: { type: "string", description: "插件名" },
    version: { type: "string", description: "插件版本" },
    state: {
      type: "string",
      enum: ["discovered", "enabled", "disabled", "error"],
      description: "运行时生命周期状态",
    },
    enabled: { type: "boolean", description: "是否已启用" },
    coreCompatibility: { type: "string", description: "核心兼容版本" },
    lastError: { type: "string", description: "最近一次错误信息" },
    updatedAt: { type: "string", description: "更新时间（ISO）" },
    menus: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          path: { type: "string" },
          permissionCodes: { type: "array", items: { type: "string" } },
        },
      },
    },
    syncStatus: {
      anyOf: [{ $ref: "sysPluginSyncStatus#" }, { type: "null" }],
    },
  },
  required: ["name", "version", "state", "enabled"],
} as const;

export const sysPluginHookReport = {
  $id: "sysPluginHookReport",
  type: "object",
  description: "插件 Hook 执行报告（plugin-platform/hooks.ts → HookEmitReport）",
  properties: {
    id: { type: "string", description: "兼容字段：可能由调用方基于 traceId 拼接" },
    pluginName: { type: "string", description: "兼容字段：调用方展示用，HookBus 暂未填充" },
    hookName: { type: "string", description: "兼容字段：调用方展示用，等价于 event" },
    traceId: { type: "string" },
    event: { type: "string", description: "Hook 事件名" },
    phase: {
      type: "string",
      enum: ["pre", "main", "post", "pipeline"],
    },
    failPolicy: {
      type: "string",
      enum: ["abort", "continue", "bestEffort"],
    },
    durationMs: { type: "number" },
    shortCircuited: { type: "boolean" },
    idempotencyKey: { type: "string" },
    status: { type: "string", enum: ["success", "error", "skipped"] },
    message: { type: "string", description: "兼容字段：调用方展示用" },
    createdAt: { type: "string", description: "兼容字段：调用方展示用" },
    handlers: {
      type: "array",
      items: { type: "object" },
    },
  },
  required: ["event", "status"],
} as const;

export const sysPluginSyncLog = {
  $id: "sysPluginSyncLog",
  type: "object",
  description: "插件菜单同步历史记录（plugin-menu-sync.service.ts → SyncLogRecord）",
  properties: {
    id: { type: "integer" },
    strategy: { type: "string", enum: ["strict", "safe"] },
    status: { type: "string", enum: ["success", "partial", "failed"] },
    created: { type: "integer" },
    updated: { type: "integer" },
    skipped: { type: "integer" },
    conflicted: { type: "integer" },
    conflictDetails: {
      type: "array",
      items: { $ref: "sysPluginConflictDetail#" },
    },
    errorMessage: { type: ["string", "null"] },
    createdAt: { type: "string", description: "ISO 时间戳" },
  },
  required: ["strategy", "status", "created", "updated", "skipped", "conflicted", "createdAt"],
} as const;

// 响应信封（与 ResponseUtil.success 输出对齐：{ success, code, message, timestamp, data }）
export const sysPluginResp = {
  $id: "sysPluginResp",
  type: "object",
  properties: {
    success: { type: "boolean" },
    code: { type: "integer" },
    message: { type: "string" },
    timestamp: { type: "string" },
    data: { $ref: "sysPlugin#" },
  },
  required: ["success", "code", "message", "timestamp", "data"],
} as const;

export const sysPluginListResp = {
  $id: "sysPluginListResp",
  type: "object",
  properties: {
    success: { type: "boolean" },
    code: { type: "integer" },
    message: { type: "string" },
    timestamp: { type: "string" },
    data: {
      type: "array",
      items: { $ref: "sysPlugin#" },
    },
  },
  required: ["success", "code", "message", "timestamp", "data"],
} as const;

export const sysPluginSyncLogListResp = {
  $id: "sysPluginSyncLogListResp",
  type: "object",
  properties: {
    success: { type: "boolean" },
    code: { type: "integer" },
    message: { type: "string" },
    timestamp: { type: "string" },
    data: {
      type: "array",
      items: { $ref: "sysPluginSyncLog#" },
    },
  },
  required: ["success", "code", "message", "timestamp", "data"],
} as const;

export const sysPluginHookReportListResp = {
  $id: "sysPluginHookReportListResp",
  type: "object",
  properties: {
    success: { type: "boolean" },
    code: { type: "integer" },
    message: { type: "string" },
    timestamp: { type: "string" },
    data: {
      type: "array",
      items: { $ref: "sysPluginHookReport#" },
    },
  },
  required: ["success", "code", "message", "timestamp", "data"],
} as const;

// querystring schemas —— 让生成器把 limit / strategy 写入 enablePluginParams /
// syncPluginMenuParams / getPluginSyncLogsParams，page 端就能用 params + options
// 的双对象形态调用，否则会被强制成 unknown。
export const sysPluginListQuery = {
  $id: "sysPluginListQuery",
  type: "object",
  properties: {},
} as const;

export const sysPluginSyncLogQuery = {
  $id: "sysPluginSyncLogQuery",
  type: "object",
  properties: {
    limit: {
      type: "integer",
      minimum: 1,
      maximum: 200,
      default: 10,
      description: "返回条数，默认 10",
    },
  },
} as const;

export const sysPluginHookReportQuery = {
  $id: "sysPluginHookReportQuery",
  type: "object",
  properties: {
    limit: {
      type: "integer",
      minimum: 1,
      maximum: 200,
      default: 50,
      description: "返回条数，默认 50",
    },
  },
} as const;

export const sysPluginEnableQuery = {
  $id: "sysPluginEnableQuery",
  type: "object",
  properties: {
    strategy: {
      type: "string",
      enum: ["strict", "safe"],
      default: "safe",
      description: "菜单同步策略",
    },
  },
} as const;

export const sysPluginSyncQuery = {
  $id: "sysPluginSyncQuery",
  type: "object",
  properties: {
    strategy: {
      type: "string",
      enum: ["strict", "safe"],
      default: "safe",
      description: "菜单同步策略",
    },
  },
} as const;
