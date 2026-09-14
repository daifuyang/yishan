import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import CustomerDrawer from './CustomerDrawer';

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

jest.mock('@/services/crm', () => ({
  getCustomer: jest.fn().mockResolvedValue({
    id: 7,
    name: '上海示例客户',
    type: 'enterprise',
    code: 'CUS-007',
    statusId: 1,
    statusName: '跟进中',
    sourceId: 2,
    sourceName: '官网咨询',
    level: 'A',
    industry: '软件服务',
    phone: null,
    website: null,
    province: '上海',
    city: '上海',
    address: null,
    ownerUserId: 1,
    ownerUserName: '销售甲',
    ownerDepartmentId: null,
    poolStatus: 'owned',
    lastFollowUpAt: '2026-09-14T09:00:00.000Z',
    nextFollowUpAt: '2026-09-15T09:00:00.000Z',
    remark: null,
    creatorId: 1,
    createdAt: '2026-09-01T09:00:00.000Z',
    updaterId: 1,
    updatedAt: '2026-09-14T09:00:00.000Z',
    tagIds: [],
    primaryContactId: 3,
    primaryContactName: '王敏',
  }),
  deleteCustomer: jest.fn(),
  listContactsByCustomer: jest.fn().mockResolvedValue([]),
  listActivitiesByCustomer: jest.fn().mockResolvedValue({ items: [] }),
  listOpportunities: jest.fn().mockResolvedValue({ data: [], total: 0 }),
  listContracts: jest.fn().mockResolvedValue({ data: [], total: 0 }),
  listPaymentsByContract: jest.fn().mockResolvedValue([]),
  listQuotations: jest.fn().mockResolvedValue({ data: [], total: 0 }),
  listTasks: jest.fn().mockResolvedValue({ data: [], total: 0 }),
  maskPhone: (phone: string) => phone,
}));

jest.mock('@/utils/permission', () => ({
  usePermission: () => () => true,
}));

jest.mock('./_shared/DrawerChrome', () => ({
  __esModule: true,
  default: ({ children }: any) =>
    require('react').createElement('div', null, children),
}));

jest.mock('./_shared/useResizableDrawer', () => ({
  useResizableDrawer: () => [1100, jest.fn()],
}));

describe('CustomerDrawer', () => {
  it('renders the V0.1 customer lifecycle tabs and exposes 新增跟进 as the primary action', async () => {
    render(
      React.createElement(CustomerDrawer, {
        open: true,
        customerId: 7,
        onClose: jest.fn(),
        statuses: [],
      }),
    );

    await waitFor(() => expect(screen.getAllByText('上海示例客户').length).toBeGreaterThan(0));

    expect(
      screen.getAllByRole('tab').map((tab) => tab.textContent),
    ).toEqual([
      '概览',
      '历程',
      '联系人',
      '商机',
      '报价单',
      '合同',
      '回款',
      '任务',
      '附件',
    ]);
    expect(
      screen.getByRole('button', { name: '新增跟进' }).classList.contains('ant-btn-primary'),
    ).toBe(true);
  });
});
