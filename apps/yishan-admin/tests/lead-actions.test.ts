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
  sourceName: '官网咨询',
  intention: '需要 CRM 方案',
  status: 'pending',
  ownerUserId: 7,
  ownerUserName: '李四',
  ownerDepartmentId: 3,
  createdBy: 7,
  createdByUserName: '李四',
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
  // 更多菜单约定（与 LeadDetailDrawer 内的 ActivityRail 解耦）：
  //   1. 转为客户（已转化则改为「查看客户详情」）
  //   2. 转交给同事
  //   3. 退回线索池
  // 「写跟进」由详情抽屉内的 ActivityRail 承担，不在更多菜单暴露。
  // 「查看」由行点击触发，也不在此处暴露。
  it.each([
    ['pending'],
    ['contact_valid'],
    ['contact_invalid'],
    ['closed'],
  ] as const)('%s 状态未转化时显示 转为客户 / 转交给同事 / 退回线索池', (status) => {
    const result = getLeadActions({ ...lead, status } as LeadRow).map(
      (action) => action.key,
    );
    expect(result).toEqual(['convert', 'transfer', 'returnToPool']);
  });

  it.each([
    ['pending'],
    ['contact_valid'],
    ['contact_invalid'],
    ['closed'],
  ] as const)('%s 状态转化后首位替换为「查看客户详情」', (status) => {
    const actions = getLeadActions({
      ...lead,
      status,
      convertedCustomerId: 99,
      convertedAt: '2026-09-07T09:00:00.000Z',
      isConverted: true,
    } as LeadRow);

    expect(actions.map((action) => action.key)).toEqual([
      'openCustomer',
      'transfer',
      'returnToPool',
    ]);
    expect(actions[0]).toMatchObject({
      label: '查看客户详情',
      primary: true,
    });
  });

  it('未转化时首位 label = 转为客户 且 primary', () => {
    const actions = getLeadActions(lead as LeadRow);
    expect(actions[0]).toMatchObject({
      label: '转为客户',
      primary: true,
    });
  });

  it('转交给同事 label 文案正确', () => {
    const actions = getLeadActions(lead as LeadRow);
    expect(actions.find((a) => a.key === 'transfer')).toMatchObject({
      label: '转交给同事',
    });
  });

  it('退回线索池 label 文案正确且位于末尾', () => {
    const actions = getLeadActions(lead as LeadRow);
    expect(actions.at(-1)).toMatchObject({
      label: '退回线索池',
    });
  });
});
