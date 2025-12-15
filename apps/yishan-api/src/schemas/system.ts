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
}
