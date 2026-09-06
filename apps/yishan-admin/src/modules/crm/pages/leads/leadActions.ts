import type { LeadRow } from '@/services/crm';

/**
 * 状态 → 操作 映射表。
 *
 * 设计原则：
 *   - 这是纯函数：仅依赖 lead.status 等只读字段，不读权限（权限由 crm:lead:* 控制）。
 *   - "transfer" 表示"转移/退回公海"，与状态无关；终态（converted / disqualified）禁用。
 *   - "openCustomer" 是 converted 专属入口：用于跳转关联客户/联系人。
 *   - "qualify" / "convert" / "reactivate" 是受控命令，与状态一一对应：
 *       new          → 仅 followUp + disqualify
 *       processing   → 可 qualify / disqualify
 *       qualified    → 可 convert / disqualify
 *       disqualified → 仅 reactivate（受权限控制）
 *       converted    → 仅查看 + 跳转客户
 */
export type LeadActionKey =
  | 'view'
  | 'edit'
  | 'followUp'
  | 'transfer'
  | 'qualify'
  | 'disqualify'
  | 'reactivate'
  | 'convert'
  | 'openCustomer';

export interface LeadAction {
  key: LeadActionKey;
  label: string;
  danger?: boolean;
  primary?: boolean;
}

export function getLeadActions(lead: LeadRow): LeadAction[] {
  switch (lead.status) {
    case 'new':
      return [
        { key: 'view', label: '查看' },
        { key: 'followUp', label: '写跟进', primary: true },
        { key: 'transfer', label: '转移/退回公海' },
        { key: 'disqualify', label: '作废', danger: true },
      ]
    case 'processing':
      return [
        { key: 'view', label: '查看' },
        { key: 'followUp', label: '写跟进', primary: true },
        { key: 'transfer', label: '转移/退回公海' },
        { key: 'qualify', label: '判为有效' },
        { key: 'disqualify', label: '作废', danger: true },
      ]
    case 'qualified':
      return [
        { key: 'view', label: '查看' },
        { key: 'followUp', label: '写跟进' },
        { key: 'transfer', label: '转移/退回公海' },
        { key: 'convert', label: '转为客户', primary: true },
        { key: 'disqualify', label: '作废', danger: true },
      ]
    case 'disqualified':
      return [
        { key: 'view', label: '查看' },
        { key: 'reactivate', label: '重新激活', primary: true },
      ]
    case 'converted':
      return [
        { key: 'view', label: '查看' },
        { key: 'openCustomer', label: '查看客户', primary: true },
      ]
    default:
      return [{ key: 'view', label: '查看' }]
  }
}
