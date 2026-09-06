import {
  buildLeadTimeline,
  filterLeadTimelineByDateRange,
  groupLeadTimelineByDate,
} from '../src/modules/crm/pages/leads/leadTimeline';
import type { LeadActivityRow, LeadRow } from '../src/services/crm';

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
  status: 'qualified',
  ownerUserId: 7,
  ownerUserName: '李四',
  ownerDepartmentId: 3,
  poolStatus: 'owned' as const,
  createdBy: 7,
  lastFollowUpAt: '2026-09-05T10:00:00.000Z',
  nextFollowUpAt: '2026-09-10T10:00:00.000Z',
  disqualifyReason: null,
  convertedCustomerId: null,
  convertedContactId: null,
  convertedAt: null,
  createdAt: '2026-09-01T09:00:00.000Z',
  updatedAt: '2026-09-06T09:00:00.000Z',
} satisfies LeadRow;

describe('线索动态', () => {
  it('合并持久化跟进与系统创建事件，并按日期分组', () => {
    const activities: LeadActivityRow[] = [
      {
        id: 1,
        leadId: lead.id,
        type: 'phone',
        content: '客户正在评估权限方案',
        occurredAt: '2026-09-06T10:00:00.000Z',
        nextFollowUpAt: '2026-09-10T10:00:00.000Z',
        operatorUserId: 7,
        operatorUserName: '李四',
        createdAt: '2026-09-06T10:00:00.000Z',
        updatedAt: '2026-09-06T10:00:00.000Z',
      },
      {
        id: 2,
        leadId: lead.id,
        type: 'status_change',
        content: '待处理 → 有效',
        occurredAt: '2026-09-05T10:00:00.000Z',
        nextFollowUpAt: null,
        operatorUserId: 7,
        operatorUserName: '李四',
        createdAt: '2026-09-05T10:00:00.000Z',
        updatedAt: '2026-09-05T10:00:00.000Z',
      },
    ];
    const events = buildLeadTimeline(lead, activities);
    expect(events[0]).toMatchObject({
      category: 'followup',
      title: '电话跟进',
      operator: '李四',
    });
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: 'system', title: '新建线索' }),
      ]),
    );
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: 'status', title: '状态变更' }),
      ]),
    );
    expect(groupLeadTimelineByDate(events).map((group) => group.date)).toEqual([
      '2026-09-06',
      '2026-09-05',
      '2026-09-01',
    ]);
  });

  it('仅保留创建时间落在所选日期范围内的动态', () => {
    const events = buildLeadTimeline(lead, [
      {
        id: 1,
        leadId: lead.id,
        type: 'phone',
        content: '今日跟进',
        occurredAt: '2026-09-06T10:00:00.000Z',
        nextFollowUpAt: null,
        operatorUserId: 7,
        operatorUserName: '李四',
        createdAt: '2026-09-06T10:00:00.000Z',
        updatedAt: '2026-09-06T10:00:00.000Z',
      },
    ]);

    expect(
      filterLeadTimelineByDateRange(events, [
        '2026-09-05T00:00:00.000Z',
        '2026-09-06T23:59:59.999Z',
      ]).map((event) => event.id),
    ).toEqual(['followup-1']);
  });
});
