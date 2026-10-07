import { render, screen } from '@testing-library/react';
import React from 'react';
import type { ActivityRow } from '@/services/crm';
import ActivityTimeline from './ActivityTimeline';

const statusChangedActivity: ActivityRow = {
  id: 1,
  customerId: 7,
  contactId: null,
  type: 'status_change',
  content: 'status_change: potential -> following',
  occurredAt: '2026-09-15T12:24:00.000Z',
  nextFollowUpAt: null,
  metadata: { from: 'potential', to: 'following' },
  operatorUserId: 2,
  operatorUserName: '王销售',
  createdAt: '2026-09-15T12:24:00.000Z',
  updatedAt: '2026-09-15T12:24:00.000Z',
};

const followUpActivity: ActivityRow = {
  id: 2,
  customerId: 7,
  contactId: 3,
  category: 'follow_up',
  type: 'phone',
  content:
    '首次电话沟通。客户目前约有 20 家直营网点，客户及门店服务记录主要通过 Excel 和微信群维护。',
  occurredAt: new Date().toISOString(),
  nextFollowUpAt: '2026-10-03T02:00:00.000Z',
  nextFollowUpPlan: '发送产品介绍资料，并安排一次 30 分钟线上产品演示。',
  metadata: null,
  operatorUserId: 2,
  operatorUserName: '张三',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('ActivityTimeline', () => {
  it('renders status changes as Chinese business language', () => {
    render(<ActivityTimeline items={[statusChangedActivity]} groupByDate />);

    expect(screen.getByText('状态变更')).toBeTruthy();
    expect(
      screen.getByText('客户状态由「潜在客户」变更为「跟进中」'),
    ).toBeTruthy();
    expect(screen.queryByText(/status_change/)).toBeNull();
    expect(screen.queryByText(/potential/)).toBeNull();
  });

  it('renders a follow-up with operator, content and next step', () => {
    render(<ActivityTimeline items={[followUpActivity]} groupByDate />);

    expect(screen.getByText('电话跟进')).toBeTruthy();
    expect(screen.getByText('· 张三')).toBeTruthy();
    expect(screen.getByText(/首次电话沟通/)).toBeTruthy();
    expect(
      screen.getByText(/下一步：.*发送产品介绍资料，并安排一次 30 分钟线上产品演示/),
    ).toBeTruthy();
  });
});
