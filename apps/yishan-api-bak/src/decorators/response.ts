/**
 * 响应装饰器
 * 用于简化路由处理函数的响应返回
 */

import { FastifyRequest, FastifyReply } from 'fastify'
import { ResponseUtil } from '../utils/response.js'

/**
 * 成功响应装饰器
 * @param message 响应消息
 * @param code 响应状态码
 */
export function Success(message?: string, code?: number) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const [request, reply] = args as [FastifyRequest, FastifyReply]
      
      try {
        const result = await originalMethod.apply(this, args)
        
        if (result && typeof result === 'object' && 'data' in result && 'total' in result) {
          const { data, total, page = 1, pageSize = 10 } = result
          return ResponseUtil.paginated(reply, request, data, total, page, pageSize, message)
        } else {
          return ResponseUtil.success(reply, request, result, message)
        }
      } catch (error) {
        throw error
      }
    }

    return descriptor
  }
}

/**
 * 创建成功响应装饰器
 * @param message 响应消息
 */
export function Created(message?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const [request, reply] = args as [FastifyRequest, FastifyReply]
      
      try {
        const result = await originalMethod.apply(this, args)
        return ResponseUtil.success(reply, request, result, message)
      } catch (error) {
        throw error
      }
    }

    return descriptor
  }
}

/**
 * 更新成功响应装饰器
 * @param message 响应消息
 */
export function Updated(message?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const [request, reply] = args as [FastifyRequest, FastifyReply]
      
      try {
        const result = await originalMethod.apply(this, args)
        return ResponseUtil.success(reply, request, result, message)
      } catch (error) {
        throw error
      }
    }

    return descriptor
  }
}

/**
 * 删除成功响应装饰器
 * @param message 响应消息
 */
export function Deleted(message?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const [request, reply] = args as [FastifyRequest, FastifyReply]
      
      try {
        await originalMethod.apply(this, args)
        return ResponseUtil.success(reply, request, null, message)
      } catch (error) {
        throw error
      }
    }

    return descriptor
  }
}

/**
 * 错误处理装饰器
 * 自动捕获异常并返回统一错误响应
 */
export function HandleError() {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const [request, reply] = args as [FastifyRequest, FastifyReply]
      
      try {
        return await originalMethod.apply(this, args)
      } catch (error: any) {
        const statusCode = error.statusCode || error.status || 500
        const message = error.message || 'Internal Server Error'
        
        return ResponseUtil.error(reply, request, statusCode, message)
      }
    }

    return descriptor
  }
}

/**
 * 分页响应装饰器
 * @param message 响应消息
 */
export function Paginated(message?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const [request, reply] = args as [FastifyRequest, FastifyReply]
      
      try {
        const result = await originalMethod.apply(this, args)
        const { data, total, page = 1, pageSize = 10 } = result
        
        return ResponseUtil.paginated(reply, request, data, total, page, pageSize, message)
      } catch (error) {
        throw error
      }
    }

    return descriptor
  }
}

/**
 * 列表响应装饰器
 * @param message 响应消息
 */
export function List(message?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const [request, reply] = args as [FastifyRequest, FastifyReply]
      
      try {
        const result = await originalMethod.apply(this, args)
        return ResponseUtil.success(reply, request, result, message)
      } catch (error) {
        throw error
      }
    }

    return descriptor
  }
}