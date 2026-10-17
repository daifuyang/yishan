import type { AppQueryDb } from '@yishan/core-system-api/database'
import { aiAudit } from '../db/schema.js'

/**
 * AI 能力执行审计写入器。
 *
 * 审计写失败**不能**反过来让业务操作失败——操作已经发生了，把它标记成失败是撒谎。
 * 所以这里吞掉异常并留下一条 stderr，行查不到的风险由运维日志兜底。
 */
export interface AiAuditRecord {
  requestId: string
  conversationId?: string
  actorId: number
  sessionId?: string
  capabilityName: string
  operationId: string
  riskLevel: string
  permissionDecision: 'allowed' | 'denied' | 'skipped'
  executionStatus: 'success' | 'failed' | 'denied' | 'rejected'
  targetType?: string
  targetId?: string
  inputDigest?: string
  errorSummary?: string
  durationMs?: number
  tokenUsage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number }
}

export interface AiAuditStore {
  write(record: AiAuditRecord): Promise<void>
  /**
   * 在调用方的事务里写审计，**失败向上抛**。
   *
   * 与 `write()` 相反：普通能力执行里「操作已发生、审计没写成」可以事后补，
   * 但用户创建的成功审计与业务创建同生共死（设计 §11）—— 回执写不进事务就等于
   * 没有回执。因此这里不做任何吞异常。
   */
  writeInTransaction(tx: AppQueryDb, record: AiAuditRecord): Promise<void>
}

export class AiAuditRepository implements AiAuditStore {
  constructor(private readonly db: AppQueryDb) {}

  async write(record: AiAuditRecord): Promise<void> {
    try {
      await this.db.insert(aiAudit).values({ ...record, createdAt: new Date() })
    } catch (error) {
      console.error('[ai-audit] write failed:', error instanceof Error ? error.message : error)
    }
  }

  async writeInTransaction(tx: AppQueryDb, record: AiAuditRecord): Promise<void> {
    await tx.insert(aiAudit).values({ ...record, createdAt: new Date() })
  }
}

/**
 * 入参摘要：只留字段名，不留值。
 *
 * 留字段名足以定位「模型到底传了什么结构」用于排查，留值就会让审计表变成
 * 第二份敏感数据副本——那正是规格禁止的。
 */
export function digestInput(input: unknown): string {
  if (!input || typeof input !== 'object') return Array.isArray(input) ? '[]' : typeof input
  const keys = Object.keys(input as Record<string, unknown>).sort()
  return keys.length ? keys.join(',').slice(0, 512) : '{}'
}

export function summarizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.slice(0, 512)
}
