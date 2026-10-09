import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import OverviewTab from './OverviewTab';
import { transitionCustomerRelationshipStatus } from '@/services/crm';

jest.mock('@/services/crm', () => ({
  listAllPages: (load: any) => load(1, 100).then((result: any) => result.data),
  listContracts: jest.fn().mockResolvedValue({ data: [], total: 0 }),
  listOpportunities: jest.fn().mockResolvedValue({ data: [], total: 0 }),
  listPaymentsByContract: jest.fn().mockResolvedValue([]),
  transitionCustomerRelationshipStatus: jest.fn().mockResolvedValue({}),
}));

jest.mock('../_shared/useBreakpoint', () => () => true);
jest.mock('../sub/CustomerActivityRail', () => () => null);

class MessageChannelMock {
  port1 = { onmessage: null as ((event: MessageEvent) => void) | null };
  port2 = {
    postMessage: () => this.port1.onmessage?.(new MessageEvent('message')),
  };
}

globalThis.MessageChannel = MessageChannelMock as unknown as typeof MessageChannel;

const customer = {
  id: 12,
  name: 'Acme',
  type: 'enterprise',
  code: 'CUS-012',
  statusCode: 'following',
  relationshipStatus: 'following',
  statusName: '\u8ddf\u8fdb\u4e2d',
  sourceId: null,
  sourceName: null,
  level: null,
  industry: null,
  phone: null,
  website: null,
  province: null,
  city: null,
  address: null,
  ownerUserId: 1,
  ownerUserName: 'Owner',
  ownerDepartmentId: null,
  poolStatus: 'owned',
  lastFollowUpAt: null,
  nextFollowUpAt: null,
  remark: null,
  creatorId: 1,
  createdAt: '2026-09-14T09:00:00.000Z',
  updaterId: 1,
  updatedAt: '2026-09-14T09:00:00.000Z',
  tagIds: [],
  primaryContactId: null,
  primaryContactName: null,
};

describe('OverviewTab customer relationship controls', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps lost outside the projected lifecycle and transitions through the dedicated endpoint', async () => {
    render(
      React.createElement(OverviewTab, {
        customer,
        onRelationshipStatusChanged: jest.fn(),
      }),
    );

    await screen.findByText('Acme');
    const lifecycle = screen.getByLabelText('customer-lifecycle');
    expect(within(lifecycle).getByText('\u6f5c\u5728')).toBeTruthy();
    expect(within(lifecycle).getByText('\u8ddf\u8fdb\u4e2d')).toBeTruthy();
    expect(within(lifecycle).getByText('\u6709\u5546\u673a')).toBeTruthy();
    expect(within(lifecycle).getByText('\u5df2\u6210\u4ea4')).toBeTruthy();
    expect(within(lifecycle).queryByText('\u5df2\u6d41\u5931')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /\u66f4\s*\u591a/ }));
    fireEvent.change(screen.getByRole('combobox', { name: '\u6d41\u5931\u539f\u56e0' }), {
      target: { value: 'no_need' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: '\u5907\u6ce8' }), {
      target: { value: '\u5ba2\u6237\u6682\u65e0\u91c7\u8d2d\u8ba1\u5212' },
    });
    fireEvent.click(screen.getByRole('button', { name: /\u786e\s*\u5b9a/ }));

    await waitFor(() =>
      expect(transitionCustomerRelationshipStatus).toHaveBeenCalledWith(12, {
        target: 'lost',
        reasonCode: 'no_need',
        remark: '\u5ba2\u6237\u6682\u65e0\u91c7\u8d2d\u8ba1\u5212',
      }),
    );
  });
});
