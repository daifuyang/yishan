import { getLeadActions } from '../src/modules/crm/pages/leads/leadActions';
import type { LeadRow } from '../src/services/crm';

const lead = {
  id: 42,
  name: '王小明',
  companyName: '移山科技',
  mobile: '13800138000',
  phone: null,
  email: 'wang@example.com',
  wechat: null,
  qq: null,
  sourceId: 1,
  intention: '需要 CRM 方案',
  status: 'new',
  ownerUserId: 7,
  ownerUserName: '李四',
  ownerDepartmentId: 3,
  poolStatus: 'owned' as const,
  createdBy: 7,
  lastFollowUpAt: null,
  nextFollowUpAt: null,
  disqualifyReason: null,
  disqualifyCode: null,
  convertedCustomerId: null,
  convertedContactId: null,
  convertedAt: null,
  createdAt: '2026-09-01T09:00:00.000Z',
  updatedAt: '2026-09-06T09:00:00.000Z',
} satisfies LeadRow;

describe('getLeadActions', () => {
  it.each([
    ['new', ['view', 'followUp', 'transfer', 'disqualify']],
    ['processing', ['view', 'followUp', 'transfer', 'qualify', 'disqualify']],
    ['qualified', ['view', 'followUp', 'transfer', 'convert', 'disqualify']],
    ['disqualified', ['view', 'reactivate']],
    ['converted', ['view', 'openCustomer']],
  ] as const)('shows only business actions for %s', (status, expected) => {
    const result = getLeadActions({ ...lead, status } as LeadRow).map(
      (action) => action.key,
    );
    expect(result).toEqual(expected);
  });
});
