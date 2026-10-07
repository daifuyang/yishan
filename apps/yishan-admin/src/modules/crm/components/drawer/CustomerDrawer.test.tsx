import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import React from 'react';
import CustomerDrawer from './CustomerDrawer';

jest.mock('@ant-design/pro-components', () => {
  const actual = jest.requireActual('@ant-design/pro-components');
  return {
    ...actual,
    ModalForm: ({ open, title }: any) =>
      open
        ? require('react').createElement('div', { role: 'dialog' }, title)
        : null,
  };
});

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver =
  ResizeObserverMock as unknown as typeof ResizeObserver;

jest.mock('@/services/crm', () => ({
  getCustomer: jest.fn().mockResolvedValue({
    id: 7,
    name: '上海示例客户',
    type: 'enterprise',
    code: 'CUS-007',
    statusCode: 'following',
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
  transitionCustomerRelationshipStatus: jest.fn().mockResolvedValue({}),
  listQuotations: jest.fn().mockResolvedValue({ data: [], total: 0 }),
  listTasks: jest.fn().mockResolvedValue({ data: [], total: 0 }),
  listAllPages: (load: any) => load(1, 100).then((result: any) => result.data),
  maskPhone: (phone: string) => phone,
}));

jest.mock('@/utils/permission', () => ({
  usePermission: () => () => true,
}));

jest.mock('./_shared/DrawerChrome', () => ({
  __esModule: true,
  default: ({ children, open }: any) =>
    open ? require('react').createElement('div', null, children) : null,
}));

jest.mock('./_shared/useResizableDrawer', () => ({
  useResizableDrawer: () => [1100, jest.fn()],
}));

jest.mock('./_shared/useBreakpoint', () => () => true);

jest.mock('./tabs/AttachmentsTab', () => () => null);

jest.mock('@/components/AttachmentSelect', () => ({
  AttachmentSelect: () => null,
}));

describe('CustomerDrawer', () => {
  it('renders the V0.1 customer lifecycle tabs and keeps 新增跟进 as the primary action', async () => {
    render(
      React.createElement(CustomerDrawer, {
        open: true,
        customerId: 7,
        onClose: jest.fn(),
      }),
    );

    await waitFor(() =>
      expect(screen.getAllByText('上海示例客户').length).toBeGreaterThan(0),
    );

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      '概览',
      '联系人',
      '商机',
      '报价单',
      '合同',
      '回款',
      '任务',
      '附件',
    ]);
    expect(
      screen.getAllByRole('button', { name: '新增跟进' }).length,
    ).toBeGreaterThan(0);
  });

  it('shows the customer lifecycle steps above the overview details', async () => {
    render(
      React.createElement(CustomerDrawer, {
        open: true,
        customerId: 7,
        onClose: jest.fn(),
      }),
    );

    await waitFor(() =>
      expect(
        screen.getAllByText('\u4e0a\u6d77\u793a\u4f8b\u5ba2\u6237').length,
      ).toBeGreaterThan(0),
    );

    const lifecycle = within(screen.getByLabelText('customer-lifecycle'));
    expect(lifecycle.getByText('\u6f5c\u5728')).toBeTruthy();
    expect(lifecycle.getByText('\u8ddf\u8fdb\u4e2d')).toBeTruthy();
    expect(lifecycle.getByText('\u6709\u5546\u673a')).toBeTruthy();
    expect(lifecycle.getByText('\u5df2\u6210\u4ea4')).toBeTruthy();
    expect(lifecycle.queryByText('\u5df2\u6d41\u5931')).toBeNull();
  });

  it('renders overview field headings as Chinese text', async () => {
    render(
      React.createElement(CustomerDrawer, {
        open: true,
        customerId: 7,
        onClose: jest.fn(),
      }),
    );

    await waitFor(() =>
      expect(
        screen.getAllByText('\u4e0a\u6d77\u793a\u4f8b\u5ba2\u6237').length,
      ).toBeGreaterThan(0),
    );

    expect(screen.getByText('\u8054\u7cfb\u4fe1\u606f')).toBeTruthy();
    expect(screen.getByText('\u4e1a\u52a1\u4fe1\u606f')).toBeTruthy();
    expect(screen.getByText('\u6210\u4ea4\u6982\u51b5')).toBeTruthy();
  });

  it('gives the activity rail a responsive desktop width', async () => {
    render(
      React.createElement(CustomerDrawer, {
        open: true,
        customerId: 7,
        onClose: jest.fn(),
      }),
    );

    await waitFor(() =>
      expect(
        screen.getAllByText('\u4e0a\u6d77\u793a\u4f8b\u5ba2\u6237').length,
      ).toBeGreaterThan(0),
    );

    expect(
      screen.getByTestId('customer-overview-layout').style.gridTemplateColumns,
    ).toBe('minmax(0, 1fr) minmax(440px, 28%)');
  });

  it('keeps V0.1 excluded expense and invoice actions out of the create menu', async () => {
    render(
      React.createElement(CustomerDrawer, {
        open: true,
        customerId: 7,
        onClose: jest.fn(),
      }),
    );

    await waitFor(() =>
      expect(
        screen.getAllByText('\u4e0a\u6d77\u793a\u4f8b\u5ba2\u6237').length,
      ).toBeGreaterThan(0),
    );
    fireEvent.click(screen.getByRole('button', { name: /\u65b0\u589e down/ }));

    expect(screen.queryByText('\u8d39\u7528')).toBeNull();
    expect(screen.queryByText('\u5f00\u7968\u8bb0\u5f55')).toBeNull();
    expect(screen.getAllByText('\u5546\u673a').length).toBeGreaterThan(1);
  });

  it('does not reopen the follow-up form after the drawer is reopened', async () => {
    const props = { customerId: 7, onClose: jest.fn() };
    const { rerender } = render(
      React.createElement(CustomerDrawer, { ...props, open: true }),
    );

    await waitFor(() =>
      expect(screen.getAllByText('上海示例客户').length).toBeGreaterThan(0),
    );
    fireEvent.click(screen.getAllByRole('button', { name: '新增跟进' })[0]);
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());

    rerender(React.createElement(CustomerDrawer, { ...props, open: false }));
    rerender(React.createElement(CustomerDrawer, { ...props, open: true }));

    await waitFor(() =>
      expect(screen.getAllByText('上海示例客户').length).toBeGreaterThan(0),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
