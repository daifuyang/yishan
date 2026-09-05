import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { buildCustomerTableColumns } from './CustomerTableColumns';

const originalResizeObserver = globalThis.ResizeObserver;
beforeAll(() => {
  globalThis.ResizeObserver = class implements ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});
afterAll(() => {
  globalThis.ResizeObserver = originalResizeObserver;
});

type CustomerRow = import('@/services/crm').CustomerRow;
type CustomerTableColumnsOptions =
  import('./CustomerTableColumns').CustomerTableColumnsOptions;

jest.mock('./CustomerActionDropdown', () => ({
  __esModule: true,
  default: () => null,
}));
const customer: CustomerRow = {
  id: 3,
  name: '上海简策品牌咨询有限公司',
  type: 'enterprise',
  code: null,
  statusId: null,
  sourceId: null,
  level: 'B',
  industry: '品牌营销',
  phone: null,
  website: null,
  province: null,
  city: null,
  address: null,
  ownerUserId: 1,
  ownerDepartmentId: null,
  poolStatus: 'owned',
  lastFollowUpAt: null,
  nextFollowUpAt: null,
  remark: null,
  creatorId: 1,
  createdAt: '2026-09-05T09:39:35',
  updaterId: 1,
  updatedAt: '2026-09-05T09:39:35',
  ownerUserName: '愚公',
  primaryContactName: '唐悦',
  primaryContactMobile: '13800001010',
};
const options = (): CustomerTableColumnsOptions => ({
  statuses: [],
  sources: [],
  tags: [],
  primaryContactMap: new Map(),
  ownerNameMap: new Map(),
  onOpenDetail: jest.fn(),
  onChanged: jest.fn(),
});

it('shows the owner filter only from backend capability, using scoped choices', () => {
  const opts = options();
  const findOwner = () =>
    buildCustomerTableColumns(opts).find(
      (c) => c.dataIndex === 'ownerUserId' && c.hideInTable,
    );
  expect(findOwner()?.search).toBe(false);
  opts.canFilterOwners = true;
  opts.ownerOptions = [{ id: 8, name: '销售乙' }];
  expect(findOwner()?.search).not.toBe(false);
  expect(findOwner()?.valueEnum).toEqual({ 8: { text: '销售乙' } });
});
type RenderArgs = Parameters<
  NonNullable<
    import('@ant-design/pro-components').ProColumns<CustomerRow>['render']
  >
>;
function cell(key: string, row = customer, opts = options()) {
  const column = buildCustomerTableColumns(opts).find(
    (c) => c.dataIndex === key && !c.hideInTable,
  );
  return column?.render?.(
    '',
    row,
    0,
    {} as RenderArgs[3],
    {} as RenderArgs[4],
  ) as import('react').ReactNode;
}
it('renders owner and contact supplied by the list API without auxiliary maps', () => {
  render(
    React.createElement(
      React.Fragment,
      null,
      cell('primaryContactName'),
      cell('ownerUserId'),
    ),
  );
  expect(screen.getByText('愚公')).toBeTruthy();
  expect(screen.getByText('唐悦')).toBeTruthy();
  expect(screen.getByText('138 0000 1010')).toBeTruthy();
});
it('retains the tag filter and existing table columns and widths', () => {
  const opts = options();
  opts.tags = [
    {
      id: 8,
      name: '重点客户',
      color: null,
      enabled: 1,
      createdAt: '',
      updatedAt: '',
    },
  ];
  const columns = buildCustomerTableColumns(opts);
  expect(columns.find((c) => c.dataIndex === 'tagIds')).toMatchObject({
    hideInTable: true,
    valueType: 'select',
    valueEnum: { 8: { text: '重点客户' } },
    fieldProps: { mode: 'multiple' },
  });
  expect(columns.filter((c) => !c.hideInTable).map((c) => c.dataIndex)).toEqual(
    [
      'name',
      'primaryContactName',
      'statusId',
      'level',
      'ownerUserId',
      'lastFollowUpAt',
      'nextFollowUpAt',
      'sourceId',
      'updatedAt',
      'option',
    ],
  );
  expect(columns.find((c) => c.dataIndex === 'name')).toMatchObject({
    width: 240,
    fixed: 'left',
  });
});
it('renders customer type as a neutral label below the linked name', () => {
  render(cell('name'));
  const name = screen.getByText(customer.name);
  const type = screen.getByText('企业客户');
  // 轻量中性 Label：不是 antd Tag（避免与客户状态/等级 Badge 抢视觉），也没有其他业务字段。
  expect(type.closest('.ant-tag')).toBeNull();
  expect(name.compareDocumentPosition(type)).toBe(
    Node.DOCUMENT_POSITION_FOLLOWING,
  );
  expect(screen.queryByText('品牌营销')).toBeNull();
});

it('maps individual customer type to its full label', () => {
  render(cell('name', { ...customer, type: 'individual' }));
  expect(screen.getByText('个人客户')).toBeTruthy();
});

it('hides the type label when customer type is empty', () => {
  const { container } = render(cell('name', { ...customer, type: '' }));
  expect(screen.queryByText('企业客户')).toBeNull();
  expect(screen.queryByText('个人客户')).toBeNull();
  expect(container.querySelector('.customer-name-cell')?.children.length).toBe(
    1,
  );
});
it('opens the drawer exactly once on name click and preserves keyboard activation', () => {
  const opts = options();
  const onRowClick = jest.fn();
  render(
    React.createElement(
      'div',
      { onClick: onRowClick },
      cell('name', customer, opts),
    ),
  );
  const link = screen.getByRole('link', { name: customer.name });
  fireEvent.click(link);
  expect(opts.onOpenDetail).toHaveBeenCalledTimes(1);
  expect(opts.onOpenDetail).toHaveBeenCalledWith(3);
  expect(onRowClick).not.toHaveBeenCalled();
  fireEvent.keyDown(link, { key: 'Enter' });
  expect(opts.onOpenDetail).toHaveBeenCalledTimes(2);
});
it('shows a full-name tooltip on hover', async () => {
  render(cell('name'));
  fireEvent.mouseEnter(screen.getByRole('link', { name: customer.name }));
  expect((await screen.findByRole('tooltip')).textContent).toBe(customer.name);
});
it('renders compact update time and a full timestamp tooltip', async () => {
  render(cell('updatedAt'));
  fireEvent.mouseEnter(screen.getByText('09-05 09:39'));
  expect((await screen.findByRole('tooltip')).textContent).toBe(
    '2026-09-05 09:39:35',
  );
});
it('uses a placeholder for invalid update times', () => {
  render(cell('updatedAt', { ...customer, updatedAt: 'invalid' }));
  expect(screen.getByText('—')).toBeTruthy();
});
