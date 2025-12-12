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
  enum: ["defaultArticleTemplateId", "defaultPageTemplateId"],
  description: "系统参数键"
} as const;

// 设置系统参数请求
export const setSystemOptionReq = {
  $id: "setSystemOptionReq",
  type: "object",
  properties: {
    value: { type: "integer", minimum: 1, description: "参数数值（模板ID）" }
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
    data: { anyOf: [{ type: "integer" }, { type: "null" }] }
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
}
