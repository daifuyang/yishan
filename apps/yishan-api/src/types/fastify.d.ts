import { FastifyReply } from 'fastify'

// 扩展FastifyReply接口以添加响应方法
declare module 'fastify' {
  interface FastifyReply {
    sendSuccess<T>(data: T, message?: string, code?: number): FastifyReply
    sendCreated<T>(data: T, message?: string): FastifyReply
    sendUpdated<T>(data?: T, message?: string): FastifyReply
    sendDeleted(message?: string): FastifyReply
    sendList<T>(data: T[], message?: string): FastifyReply
    sendPaginated<T>(
      data: T[],
      total: number,
      page: number,
      pageSize: number,
      message?: string
    ): FastifyReply
    sendError(message?: string, code?: number, error?: any): FastifyReply
    sendValidationError(validation: Record<string, string[]>, message?: string): FastifyReply
    sendUnauthorized(message?: string): FastifyReply
    sendForbidden(message?: string): FastifyReply
    sendTooManyRequests(message?: string): FastifyReply
    sendServiceUnavailable(message?: string): FastifyReply
  }
}