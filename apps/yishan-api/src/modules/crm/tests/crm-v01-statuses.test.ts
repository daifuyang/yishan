import { describe, expect, it } from 'vitest'

async function loadStatuses() {
  return import('../domain/statuses.js')
}

describe('CRM V0.1 status descriptors', () => {
  it('exposes the five customer lifecycle states with Chinese labels and semantic tokens', async () => {
    await expect(loadStatuses()).resolves.toMatchObject({
      CUSTOMER_STATUSES: [
      { value: 'potential', label: '潜在客户', semantic: 'default' },
      { value: 'following', label: '跟进中', semantic: 'processing' },
      { value: 'opportunity', label: '商机客户', semantic: 'warning' },
      { value: 'customer', label: '正式客户', semantic: 'success' },
      { value: 'lost', label: '已流失', semantic: 'error' },
      ],
    })
  })

  it('exposes the five opportunity stages with Chinese labels and semantic tokens', async () => {
    await expect(loadStatuses()).resolves.toMatchObject({
      OPPORTUNITY_STAGES: [
      { value: 'discover', label: '需求发现', semantic: 'default' },
      { value: 'qualify', label: '方案确认', semantic: 'processing' },
      { value: 'proposal', label: '方案报价', semantic: 'warning' },
      { value: 'negotiation', label: '商务谈判', semantic: 'warning' },
      { value: 'won', label: '赢单', semantic: 'success' },
      ],
    })
  })

  it('provides quotation, contract, and task labels from the same typed descriptor shape', async () => {
    await expect(loadStatuses()).resolves.toMatchObject({
      QUOTATION_STATUSES: [
      { value: 'draft', label: '草稿', semantic: 'default' },
      { value: 'sent', label: '已发送', semantic: 'processing' },
      { value: 'accepted', label: '已接受', semantic: 'success' },
      { value: 'rejected', label: '已拒绝', semantic: 'error' },
      { value: 'voided', label: '已作废', semantic: 'default' },
      { value: 'superseded', label: '已被新版替代', semantic: 'default' },
      ],
      CONTRACT_STATUSES: [
      { value: 'draft', label: '草稿', semantic: 'default' },
      { value: 'performing', label: '履约中', semantic: 'processing' },
      { value: 'completed', label: '已完成', semantic: 'success' },
      { value: 'terminated', label: '已终止', semantic: 'error' },
      ],
      TASK_STATUSES: [
      { value: 'todo', label: '待处理', semantic: 'default' },
      { value: 'in_progress', label: '进行中', semantic: 'processing' },
      { value: 'completed', label: '已完成', semantic: 'success' },
      { value: 'cancelled', label: '已取消', semantic: 'error' },
      ],
    })
  })
})
