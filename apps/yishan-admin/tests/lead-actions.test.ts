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
  status: 'pending',
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
  isConverted: false,
  createdAt: '2026-09-01T09:00:00.000Z',
  updatedAt: '2026-09-06T09:00:00.000Z',
} satisfies LeadRow;

describe('getLeadActions', () => {
  it.each([
    ['pending'],
    ['contact_valid'],
    ['contact_invalid'],
    ['closed'],
  ] as const)('%s 状态未转化时始终可以写跟进和转为客户', (status) => {
    const result = getLeadActions({ ...lead, status } as LeadRow).map(
      (action) => action.key,
    );
    expect(result).toEqual(['view', 'followUp', 'transfer', 'convert']);
  });

  it.each([
    ['pending'],
    ['contact_valid'],
    ['contact_invalid'],
    ['closed'],
  ] as const)('%s 状态转化后显示查看客户详情而不再转为客户', (status) => {
    const actions = getLeadActions({
      ...lead,
      status,
      convertedCustomerId: 99,
      convertedAt: '2026-09-07T09:00:00.000Z',
      isConverted: true,
    } as LeadRow);

    expect(actions.map((action) => action.key)).toEqual([
      'view',
      'followUp',
      'transfer',
      'openCustomer',
    ]);
    expect(actions.at(-1)).toMatchObject({
      label: '查看客户详情',
      primary: true,
    });
  });
});
