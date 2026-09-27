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
});
