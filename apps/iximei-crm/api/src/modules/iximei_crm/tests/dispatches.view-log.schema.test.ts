/**
 * 回归测试：crmDispatchViewLog schema 已定义
 *
 * 验证 db/schema.ts 中已导出 crmDispatchViewLog 表（用于派单详情
 * 「医院查看」留痕），后续 T2/T3 将基于此表写 repository/service。
 */
import { describe, it, expect } from 'vitest'
import * as schema from '../db/schema.js'

describe('crmDispatchViewLog schema', () => {
  it('表已定义', () => {
    expect((schema as any).crmDispatchViewLog).toBeDefined()
  })
})