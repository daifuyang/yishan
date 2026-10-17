import { ResourceErrorCode, SystemErrorCode, ValidationErrorCode } from '@yishan/core-api/business-codes'

export class AiChatError extends Error {
  constructor(readonly statusCode: 400 | 404 | 409 | 503, message: string) {
    super(message)
    this.name = 'AiChatError'
  }
}

export function aiError(statusCode: 400 | 404 | 409 | 503, message: string) {
  return new AiChatError(statusCode, message)
}

/**
 * AI 模块统一的错误处理。
 *
 * `setErrorHandler` 只作用于**注册它的那一层**，兄弟插件互不影响 —— 草稿路由
 * （`drafts.ts`）与聊天路由（`index.ts`）是 autoload 加载的两个兄弟文件，两个
 * 文件都必须装这一个处理器。否则草稿里的 `AiChatError` 会掉到全局处理器上，
 * 404 / 409 一律变成 500。
 */
export function installAiErrorHandler(app: {
  setErrorHandler(handler: (error: unknown, request: unknown, reply: any) => unknown): void
}) {
  app.setErrorHandler((error, _request, reply) => {
    // Core 目前把 404/409/503 重映射了；这里只保留本资源显式抛出的错误。
    if (error instanceof AiChatError) {
      const code = error.statusCode === 404 ? ResourceErrorCode.NOT_FOUND
        : error.statusCode === 409 ? ResourceErrorCode.ALREADY_EXISTS
        : error.statusCode === 503 ? SystemErrorCode.SERVICE_UNAVAILABLE
        : ValidationErrorCode.INVALID_PARAMETER
      return reply.code(error.statusCode).send({ success: false, code, message: error.message, data: null, timestamp: new Date().toISOString() })
    }
    if (error && typeof error === 'object' && 'code' in error && error.code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
      return reply.code(413).send({ success: false, code: ValidationErrorCode.PARAMETER_LENGTH_ERROR, message: '消息内容超出 256 KiB 限制', data: null, timestamp: new Date().toISOString() })
    }
    throw error
  })
}
