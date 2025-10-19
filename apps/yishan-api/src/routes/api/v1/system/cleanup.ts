import { FastifyPluginAsync, FastifyRequest } from 'fastify'
import { CleanupService } from '../../../../services/cleanupService.js'
import { ErrorCode } from '../../../../constants/business-code.js'
import { ResponseUtil } from '../../../../utils/response.js'

const cleanupRoutes: FastifyPluginAsync = async function (fastify, opts) {
  const cleanupService = new CleanupService(fastify)

  // 清理临时文件
  fastify.post('/temp-files', {
    schema: {
      operationId: 'cleanupTempFiles',
      summary: '清理临时文件',
      description: '清理系统中的临时文件',
      tags: ['sysCleanup'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          olderThanDays: { 
            type: 'number', 
            minimum: 1, 
            default: 7,
            description: '清理多少天前的文件' 
          },
          dryRun: { 
            type: 'boolean', 
            default: false,
            description: '是否为试运行（不实际删除）' 
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 200 },
            message: { type: 'string', example: '清理完成' },
            data: {
              type: 'object',
              properties: {
                deletedCount: { type: 'number', description: '删除的文件数量' },
                freedSpace: { type: 'number', description: '释放的空间（字节）' },
                dryRun: { type: 'boolean', description: '是否为试运行' }
              }
            }
          }
        },
        401: { $ref: 'unauthorizedResponse#' },
        403: { $ref: 'forbiddenResponse#' },
        500: { $ref: 'errorResponse#' }
      }
    },
    handler: async (request: FastifyRequest, reply) => {
      try {
        // 检查用户权限
        const user = (request as any).user
        if (!user || user.role !== 'admin') {
          return ResponseUtil.forbidden(
            reply,
            request,
            '权限不足，仅管理员可执行此操作'
          )
        }

        const { olderThanDays = 7, dryRun = false } = request.body as any
        
        const result = await cleanupService.cleanupTempFiles({
          olderThanDays,
          dryRun,
          operatorId: user.id
        })
        
        const message = dryRun 
          ? `试运行完成，预计删除 ${result.deletedCount} 个文件，释放 ${(result.freedSpace / 1024 / 1024).toFixed(2)} MB 空间`
          : `清理完成，删除了 ${result.deletedCount} 个文件，释放了 ${(result.freedSpace / 1024 / 1024).toFixed(2)} MB 空间`
        
        return ResponseUtil.success(
          reply,
          request,
          result,
          message
        )
      } catch (error) {
        fastify.log.error(error)
        
        const errorMessage = error instanceof Error ? error.message : '清理临时文件失败'
        return ResponseUtil.error(
          reply,
          request,
          ErrorCode.SYSTEM_ERROR,
          errorMessage
        )
      }
    }
  })

  // 清理日志文件
  fastify.post('/logs', {
    schema: {
      operationId: 'cleanupLogs',
      summary: '清理日志文件',
      description: '清理系统中的过期日志文件',
      tags: ['sysCleanup'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          olderThanDays: { 
            type: 'number', 
            minimum: 1, 
            default: 30,
            description: '清理多少天前的日志' 
          },
          logLevel: {
            type: 'string',
            enum: ['debug', 'info', 'warn', 'error'],
            description: '要清理的日志级别'
          },
          dryRun: { 
            type: 'boolean', 
            default: false,
            description: '是否为试运行（不实际删除）' 
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 200 },
            message: { type: 'string', example: '日志清理完成' },
            data: {
              type: 'object',
              properties: {
                deletedFiles: { type: 'number', description: '删除的日志文件数量' },
                deletedRecords: { type: 'number', description: '删除的日志记录数量' },
                freedSpace: { type: 'number', description: '释放的空间（字节）' },
                dryRun: { type: 'boolean', description: '是否为试运行' }
              }
            }
          }
        },
        401: { $ref: 'unauthorizedResponse#' },
        403: { $ref: 'forbiddenResponse#' },
        500: { $ref: 'errorResponse#' }
      }
    },
    handler: async (request: FastifyRequest, reply) => {
      try {
        // 检查用户权限
        const user = (request as any).user
        if (!user || user.role !== 'admin') {
          return ResponseUtil.forbidden(
            reply,
            request,
            '权限不足，仅管理员可执行此操作'
          )
        }

        const { olderThanDays = 30, logLevel, dryRun = false } = request.body as any
        
        const result = await cleanupService.cleanupLogs({
          olderThanDays,
          logLevel,
          dryRun,
          operatorId: user.id
        })
        
        const message = dryRun 
          ? `试运行完成，预计删除 ${result.deletedFiles} 个日志文件，${result.deletedRecords} 条记录，释放 ${(result.freedSpace / 1024 / 1024).toFixed(2)} MB 空间`
          : `日志清理完成，删除了 ${result.deletedFiles} 个文件，${result.deletedRecords} 条记录，释放了 ${(result.freedSpace / 1024 / 1024).toFixed(2)} MB 空间`
        
        return ResponseUtil.success(
          reply,
          request,
          result,
          message
        )
      } catch (error) {
        fastify.log.error(error)
        
        const errorMessage = error instanceof Error ? error.message : '清理日志失败'
        return ResponseUtil.error(
          reply,
          request,
          ErrorCode.SYSTEM_ERROR,
          errorMessage
        )
      }
    }
  })

  // 清理数据库
  fastify.post('/database', {
    schema: {
      operationId: 'cleanupDatabase',
      summary: '清理数据库',
      description: '清理数据库中的过期数据',
      tags: ['sysCleanup'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          tables: {
            type: 'array',
            items: { type: 'string' },
            description: '要清理的表名列表'
          },
          olderThanDays: { 
            type: 'number', 
            minimum: 1, 
            default: 90,
            description: '清理多少天前的数据' 
          },
          dryRun: { 
            type: 'boolean', 
            default: false,
            description: '是否为试运行（不实际删除）' 
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 200 },
            message: { type: 'string', example: '数据库清理完成' },
            data: {
              type: 'object',
              properties: {
                deletedRecords: { type: 'number', description: '删除的记录数量' },
                affectedTables: { 
                  type: 'array',
                  items: { type: 'string' },
                  description: '受影响的表' 
                },
                dryRun: { type: 'boolean', description: '是否为试运行' }
              }
            }
          }
        },
        401: { $ref: 'unauthorizedResponse#' },
        403: { $ref: 'forbiddenResponse#' },
        500: { $ref: 'errorResponse#' }
      }
    },
    handler: async (request: FastifyRequest, reply) => {
      try {
        // 检查用户权限
        const user = (request as any).user
        if (!user || user.role !== 'admin') {
          return ResponseUtil.forbidden(
            reply,
            request,
            '权限不足，仅管理员可执行此操作'
          )
        }

        const { tables, olderThanDays = 90, dryRun = false } = request.body as any
        
        const result = await cleanupService.cleanupDatabase({
          tables,
          olderThanDays,
          dryRun,
          operatorId: user.id
        })
        
        const message = dryRun 
          ? `试运行完成，预计从 ${result.affectedTables.join(', ')} 表中删除 ${result.deletedRecords} 条记录`
          : `数据库清理完成，从 ${result.affectedTables.join(', ')} 表中删除了 ${result.deletedRecords} 条记录`
        
        return ResponseUtil.success(
          reply,
          request,
          result,
          message
        )
      } catch (error) {
        fastify.log.error(error)
        
        const errorMessage = error instanceof Error ? error.message : '清理数据库失败'
        return ResponseUtil.error(
          reply,
          request,
          ErrorCode.SYSTEM_ERROR,
          errorMessage
        )
      }
    }
  })
}

export default cleanupRoutes
