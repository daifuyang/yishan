import { FastifyInstance } from 'fastify'
import { Knex } from 'knex'
import * as fs from 'fs/promises'
import * as path from 'path'

export interface CleanupTempFilesOptions {
  olderThanDays: number
  dryRun: boolean
  operatorId: number
}

export interface CleanupLogsOptions {
  olderThanDays: number
  logLevel?: string
  dryRun: boolean
  operatorId: number
}

export interface CleanupDatabaseOptions {
  tables?: string[]
  olderThanDays: number
  dryRun: boolean
  operatorId: number
}

export interface CleanupTempFilesResult {
  deletedCount: number
  freedSpace: number
  dryRun: boolean
}

export interface CleanupLogsResult {
  deletedFiles: number
  deletedRecords: number
  freedSpace: number
  dryRun: boolean
}

export interface CleanupDatabaseResult {
  deletedRecords: number
  affectedTables: string[]
  dryRun: boolean
}

export class CleanupService {
  private fastify: FastifyInstance
  private knex: Knex

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify
    this.knex = (fastify as any).knex
  }

  /**
   * 清理临时文件
   */
  async cleanupTempFiles(options: CleanupTempFilesOptions): Promise<CleanupTempFilesResult> {
    const { olderThanDays, dryRun, operatorId: _operatorId } = options
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)

    let deletedCount = 0
    let freedSpace = 0

    try {
      // 获取临时文件目录
      const tempDir = process.env.TEMP_DIR || path.join(process.cwd(), 'temp')
      
      try {
        const files = await fs.readdir(tempDir)
        
        for (const file of files) {
          const filePath = path.join(tempDir, file)
          const stats = await fs.stat(filePath)
          
          if (stats.mtime < cutoffDate) {
            freedSpace += stats.size
            
            if (!dryRun) {
              await fs.unlink(filePath)
            }
            deletedCount++
          }
        }
      } catch (error) {
        // 如果临时目录不存在，忽略错误
        this.fastify.log.warn(`临时目录不存在或无法访问: ${tempDir}`)
      }

      // 记录清理操作
      if (!dryRun && deletedCount > 0) {
        this.fastify.log.info(`清理临时文件完成，删除 ${deletedCount} 个文件，释放 ${freedSpace} 字节空间`)
      }

      return {
        deletedCount,
        freedSpace,
        dryRun
      }
    } catch (error: unknown) {
      this.fastify.log.error(error)
      throw new Error('清理临时文件失败')
    }
  }

  /**
   * 清理日志文件
   */
  async cleanupLogs(options: CleanupLogsOptions): Promise<CleanupLogsResult> {
    const { olderThanDays, logLevel, dryRun, operatorId: _operatorId } = options
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)

    let deletedFiles = 0
    let deletedRecords = 0
    let freedSpace = 0

    try {
      // 清理文件日志
      const logDir = process.env.LOG_DIR || path.join(process.cwd(), 'logs')
      
      try {
        const files = await fs.readdir(logDir)
        
        for (const file of files) {
          if (logLevel && !file.includes(logLevel)) {
            continue
          }
          
          const filePath = path.join(logDir, file)
          const stats = await fs.stat(filePath)
          
          if (stats.mtime < cutoffDate) {
            freedSpace += stats.size
            
            if (!dryRun) {
              await fs.unlink(filePath)
            }
            deletedFiles++
          }
        }
      } catch (error) {
        this.fastify.log.warn(`日志目录不存在或无法访问: ${logDir}`)
      }

      // 清理数据库日志记录（如果有日志表）
      try {
        const query = this.knex('system_logs')
          .where('created_at', '<', cutoffDate)
        
        if (logLevel) {
          query.where('level', logLevel)
        }

        if (dryRun) {
          const result = await query.count('* as count').first()
          deletedRecords = result?.count ? Number(result.count) : 0
        } else {
          deletedRecords = await query.del()
        }
      } catch (error) {
        // 如果日志表不存在，忽略错误
        this.fastify.log.warn('系统日志表不存在或无法访问')
      }

      return {
        deletedFiles,
        deletedRecords,
        freedSpace,
        dryRun
      }
    } catch (error: unknown) {
      this.fastify.log.error(error)
      throw new Error('清理日志失败')
    }
  }

  /**
   * 清理数据库
   */
  async cleanupDatabase(options: CleanupDatabaseOptions): Promise<CleanupDatabaseResult> {
    const { tables, olderThanDays, dryRun, operatorId: _operatorId } = options
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)

    let deletedRecords = 0
    const affectedTables: string[] = []

    try {
      // 默认清理的表
      const defaultTables = ['audit_logs', 'system_logs', 'user_sessions', 'temp_data']
      const tablesToClean = tables || defaultTables

      for (const tableName of tablesToClean) {
        try {
          // 检查表是否存在
          const tableExists = await this.knex.schema.hasTable(tableName)
          if (!tableExists) {
            continue
          }

          // 检查表是否有created_at字段
          const hasCreatedAt = await this.knex.schema.hasColumn(tableName, 'created_at')
          if (!hasCreatedAt) {
            continue
          }

          const query = this.knex(tableName).where('created_at', '<', cutoffDate)

          if (dryRun) {
            const result = await query.count('* as count').first()
            const count = result?.count ? Number(result.count) : 0
            if (count > 0) {
              deletedRecords += count
              affectedTables.push(tableName)
            }
          } else {
            const count = await query.del()
            if (count > 0) {
              deletedRecords += count
              affectedTables.push(tableName)
            }
          }
        } catch (error: unknown) {
          this.fastify.log.warn(error)
        }
      }

      return {
        deletedRecords,
        affectedTables,
        dryRun
      }
    } catch (error: unknown) {
      this.fastify.log.error(error)
      throw new Error('清理数据库失败')
    }
  }
}