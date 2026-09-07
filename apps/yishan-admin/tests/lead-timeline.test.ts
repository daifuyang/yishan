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
  status: 'contact_valid',
  ownerUserId: 7,
  ownerUserName: '李四',
  ownerDepartmentId: 3,
  poolStatus: 'owned' as const,
  createdBy: 7,
  lastFollowUpAt: '2026-09-05T10:00:00.000Z',
  nextFollowUpAt: '2026-09-10T10:00:00.000Z',
  disqualifyReason: null,
  disqualifyCode: null,
  convertedCustomerId: null,
  convertedContactId: null,
  convertedAt: null,
  isConverted: false,
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

  it('把 conversion / reactivation / status_change 系统事件归类为 status 类，颜色一致', () => {
    const events = buildLeadTimeline(lead, [
      {
        id: 11,
        leadId: lead.id,
        type: 'status_change',
        content: '无效 → 跟进中（重新激活）：官网留资',
        occurredAt: '2026-09-06T08:00:00.000Z',
        nextFollowUpAt: null,
        operatorUserId: 7,
        operatorUserName: '李四',
        createdAt: '2026-09-06T08:00:00.000Z',
        updatedAt: '2026-09-06T08:00:00.000Z',
      },
      {
        id: 12,
        leadId: lead.id,
        type: 'conversion',
        content: '有效 → 已转化：关联客户 上海示例',
        occurredAt: '2026-09-06T09:00:00.000Z',
        nextFollowUpAt: null,
        operatorUserId: 7,
        operatorUserName: '李四',
        createdAt: '2026-09-06T09:00:00.000Z',
        updatedAt: '2026-09-06T09:00:00.000Z',
      },
    ]);

    // 来自 activities 的事件必须全部归类为 status（不包括"新建线索"这种 system 事件）。
    const activityEvents = events.filter((event) =>
      event.id.startsWith('followup-'),
    );
    expect(activityEvents.every((event) => event.category === 'status')).toBe(
      true,
    );
    expect(activityEvents.every((event) => event.color === 'blue')).toBe(true);
  });

  it('同一时刻的首次跟进先于其自动触发的状态变更展示', () => {
    const events = buildLeadTimeline(lead, [
      {
        id: 21,
        leadId: lead.id,
        type: 'status_change',
        content: '因首次跟进，系统自动将状态从「待处理」更新为「跟进中」',
        occurredAt: '2026-09-06T10:00:00.000Z',
        nextFollowUpAt: null,
        operatorUserId: 7,
        operatorUserName: '李四',
        createdAt: '2026-09-06T10:00:00.000Z',
        updatedAt: '2026-09-06T10:00:00.000Z',
      },
      {
        id: 20,
        leadId: lead.id,
        type: 'phone',
        content: '确认试用',
        occurredAt: '2026-09-06T10:00:00.000Z',
        nextFollowUpAt: '2026-09-08T01:00:00.000Z',
        operatorUserId: 7,
        operatorUserName: '李四',
        createdAt: '2026-09-06T10:00:00.000Z',
        updatedAt: '2026-09-06T10:00:00.000Z',
      },
    ]);

    expect(events.slice(0, 2).map((event) => event.title)).toEqual([
      '电话跟进',
      '状态变更',
    ]);
    expect(events[1]?.detail).toBe(
      '因首次跟进，系统自动将状态从「待处理」更新为「跟进中」',
    );
  });
});
