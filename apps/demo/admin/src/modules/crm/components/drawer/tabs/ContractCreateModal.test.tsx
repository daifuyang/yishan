import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import React from 'react';
import { App } from 'antd';
import { createContract, getQuotation } from '@/services/crm';
import ContractCreateModal from './ContractCreateModal';
type QuotationResp = import('@/services/crm').QuotationResp;
jest.mock('@/services/crm', () => ({
  createContract: jest.fn(),
  getQuotation: jest.fn(),
}));
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
class MessageChannelMock {
  port1 = { onmessage: null as ((event: MessageEvent) => void) | null };
  port2 = {
    postMessage: () =>
      setTimeout(() => this.port1.onmessage?.(new MessageEvent('message')), 0),
  };
}
globalThis.MessageChannel =
  MessageChannelMock as unknown as typeof MessageChannel;
const originalStyle = window.getComputedStyle;
beforeAll(() => {
  window.getComputedStyle = (el) => originalStyle(el);
});
afterAll(() => {
  window.getComputedStyle = originalStyle;
});
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getQuotation).mockResolvedValue(quote);
});

const quote: QuotationResp = {
  id: 1,
  seriesId: 'series-a',
  seriesNo: 'Q-20261006-0001',
  currentVersion: 1,
  versionCount: 1,
  name: '禾味餐饮 CRM 数字化项目报价',
  quotationNo: 'Q-20261010-0001',
  version: 1,
  rootQuoteId: 1,
  sourceQuoteId: null,
  customerId: 23,
  customerName: '上海禾味餐饮管理有限公司',
  opportunityId: 1,
  opportunityName: '禾味餐饮 CRM 数字化项目',
  contactId: 15,
  ownerUserId: 7,
  ownerUserName: '愚公',
  status: 'draft',
  quoteDate: '2026-10-10T00:00:00+08:00',
  validUntil: '2026-10-20T00:00:00+08:00',
  totalCents: 6600000,
  discountAmountCents: 400000,
  publicDiscountDescription: '首期合作优惠',
  internalDiscountReason:
    '客户同时对比两家CRM供应商，为推进首次合作给予竞争性报价。',
  netCents: 7000000,
  taxCents: 0,
  remark: '范围以合同为准',
  createdAt: '2026-10-10T14:00:00+08:00',
  contactName: '张明远',
  ownerDepartmentId: 10,
  creatorId: 1,
  updaterId: 1,
  updatedAt: '2026-10-10T14:00:00+08:00',
  sentAt: null,
  acceptedAt: null,
  closedAt: null,
  items: [36000, 12000, 18000, 4000].map((price, i) => ({
    id: i + 1,
    quotationId: 1,
    productId: null,
    productNameSnapshot: [
      '标准 CRM 基础方案',
      '40账号方案',
      '门店企业客户服务记录定制',
      '实施及数据初始化',
    ][i],
    description: '项目描述',
    unitSnapshot: '项',
    quantityCents: 10000,
    unitPriceCents: price * 100,
    lineAmountCents: price * 100,
    discountBp: 0,
    taxRateBp: 0,
    sortOrder: i,
    createdAt: '',
    updatedAt: '',
  })),
};

const props = {
  open: true,
  onOpenChange: jest.fn(),
  customerId: 23,
  customerName: quote.customerName ?? '',
  existingContacts: [],
  existingOpportunities: [],
  existingQuotations: [
    {
      customerId: 23,
      currentQuoteId: 1,
      title: quote.name,
      currentStatus: 'accepted' as const,
      currentAmount: 6600000,
      opportunityId: 1,
      opportunityName: quote.opportunityName,
    },
    {
      customerId: 23,
      currentQuoteId: 2,
      title: '第二份报价',
      currentStatus: 'accepted' as const,
    },
  ],
};
async function selectQuote(name = quote.name) {
  const input = screen.getByLabelText('关联报价单');
  fireEvent.mouseDown(input);
  const option = await screen.findByText(name, {
    selector: '.ant-select-item-option-content',
  });
  fireEvent.click(option);
}
function expectQuoteFields() {
  expect((screen.getByLabelText('合同名称') as HTMLInputElement).value).toBe(
    '禾味餐饮 CRM 数字化项目合同',
  );
  expect((screen.getByLabelText('合同金额') as HTMLInputElement).value).toBe(
    '66000.00',
  );
  expect((screen.getByLabelText('备注') as HTMLTextAreaElement).value).toBe(
    quote.remark,
  );
  for (const [label, name] of [
    ['关联报价单', quote.name],
    ['关联商机', quote.opportunityName],
    ['联系人', quote.contactName],
  ] as const) {
    const select = screen.getByLabelText(label).closest('.ant-select');
    expect(select?.textContent).toBe(name);
  }
  expect(
    screen.getByLabelText('关联商机').closest('.ant-select')?.className,
  ).toContain('ant-select-disabled');
  expect(
    screen.getByLabelText('联系人').closest('.ant-select')?.className,
  ).toContain('ant-select-disabled');
  expect(screen.getByText('标准 CRM 基础方案')).toBeTruthy();
}

test('直接生成合同与选择同一报价带入相同名称、商机、联系人、金额、备注和明细', async () => {
  const direct = render(
    React.createElement(ContractCreateModal, {
      ...props,
      sourceQuotation: quote,
    }),
  );
  await waitFor(expectQuoteFields);
  direct.unmount();
  render(
    React.createElement(
      App,
      null,
      React.createElement(ContractCreateModal, props),
    ),
  );
  await selectQuote();
  await waitFor(expectQuoteFields);
  expect(getQuotation).toHaveBeenCalledWith(1);
});

test('切换报价时忽略迟到的旧请求，来源没有商机或联系人时不保留旧值', async () => {
  let resolveFirst!: (value: QuotationResp) => void;
  jest.mocked(getQuotation).mockImplementation((id) =>
    id === 1
      ? new Promise((resolve) => {
          resolveFirst = resolve;
        })
      : Promise.resolve({
          ...quote,
          id: 2,
          name: '第二份报价',
          opportunityId: null,
          opportunityName: null,
          contactId: null,
          contactName: null,
          remark: '第二份备注',
          totalCents: 120000,
        }),
  );
  render(
    React.createElement(
      App,
      null,
      React.createElement(ContractCreateModal, props),
    ),
  );
  await selectQuote();
  await waitFor(() => expect(getQuotation).toHaveBeenCalledWith(1));
  await selectQuote('第二份报价');
  await waitFor(() =>
    expect((screen.getByLabelText('合同名称') as HTMLInputElement).value).toBe(
      '第二份报价合同',
    ),
  );
  await waitFor(() =>
    expect((screen.getByLabelText('合同金额') as HTMLInputElement).value).toBe(
      '1200.00',
    ),
  );
  await act(async () => resolveFirst(quote));
  expect((screen.getByLabelText('合同金额') as HTMLInputElement).value).toBe(
    '1200.00',
  );
  expect((screen.getByLabelText('备注') as HTMLTextAreaElement).value).toBe(
    '第二份备注',
  );
  expect(
    screen.getByLabelText('关联商机').closest('.ant-select')?.textContent,
  ).not.toContain(quote.opportunityName);
  expect(
    screen.getByLabelText('联系人').closest('.ant-select')?.textContent,
  ).not.toContain(quote.contactName);
});

test('报价读取失败后禁止带着摘要或旧来源提交，清除报价恢复手工创建', async () => {
  jest.mocked(getQuotation).mockRejectedValue(new Error('读取失败'));
  render(
    React.createElement(
      App,
      null,
      React.createElement(ContractCreateModal, props),
    ),
  );
  await selectQuote();
  await waitFor(() => expect(getQuotation).toHaveBeenCalledWith(1));
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: /创\s*建/ }).hasAttribute('disabled'),
    ).toBe(true),
  );
  expect(createContract).not.toHaveBeenCalled();
  const clear = screen
    .getByLabelText('关联报价单')
    .closest('.ant-select')
    ?.querySelector('.ant-select-clear');
  expect(clear).toBeTruthy();
  if (!clear) throw new Error('报价选择应允许清除');
  fireEvent.mouseDown(clear);
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: /创\s*建/ }).hasAttribute('disabled'),
    ).toBe(false),
  );
  expect((screen.getByLabelText('合同金额') as HTMLInputElement).value).toBe(
    '',
  );
});

test('两个入口提交相同来源 ID 和金额，报价有效期不会成为合同期限', async () => {
  jest.mocked(createContract).mockRejectedValue(new Error('保留输入'));
  const direct = render(
    React.createElement(
      App,
      null,
      React.createElement(ContractCreateModal, {
        ...props,
        sourceQuotation: quote,
      }),
    ),
  );
  await waitFor(expectQuoteFields);
  fireEvent.click(screen.getByRole('button', { name: /创\s*建/ }));
  await waitFor(() => expect(createContract).toHaveBeenCalledTimes(1));
  const directInput = jest.mocked(createContract).mock.calls[0][0];
  expect(directInput).toMatchObject({
    quotationId: 1,
    opportunityId: 1,
    contactId: 15,
    amountCents: 6600000,
    signedAt: undefined,
    effectiveAt: undefined,
    expiresAt: undefined,
  });
  direct.unmount();
  render(
    React.createElement(
      App,
      null,
      React.createElement(ContractCreateModal, props),
    ),
  );
  await selectQuote();
  await waitFor(expectQuoteFields);
  fireEvent.click(screen.getByRole('button', { name: /创\s*建/ }));
  await waitFor(() => expect(createContract).toHaveBeenCalledTimes(2));
  expect(jest.mocked(createContract).mock.calls[1][0]).toEqual(directInput);
});

test('清除已加载的报价会清空来源明细和关联值，重新打开也不保留旧报价', async () => {
  const modal = render(
    React.createElement(
      App,
      null,
      React.createElement(ContractCreateModal, props),
    ),
  );
  await selectQuote();
  await waitFor(expectQuoteFields);
  const clear = screen
    .getByLabelText('关联报价单')
    .closest('.ant-select')
    ?.querySelector('.ant-select-clear');
  if (!clear) throw new Error('报价选择应允许清除');
  fireEvent.mouseDown(clear);
  await waitFor(() =>
    expect(screen.queryByText('标准 CRM 基础方案')).toBeNull(),
  );
  await waitFor(() =>
    expect((screen.getByLabelText('合同金额') as HTMLInputElement).value).toBe(
      '',
    ),
  );
  expect((screen.getByLabelText('备注') as HTMLTextAreaElement).value).toBe('');
  await selectQuote();
  await waitFor(expectQuoteFields);
  modal.rerender(
    React.createElement(
      App,
      null,
      React.createElement(ContractCreateModal, { ...props, open: false }),
    ),
  );
  modal.rerender(
    React.createElement(
      App,
      null,
      React.createElement(ContractCreateModal, props),
    ),
  );
  await waitFor(() =>
    expect(screen.queryByText('标准 CRM 基础方案')).toBeNull(),
  );
  await waitFor(() =>
    expect((screen.getByLabelText('合同金额') as HTMLInputElement).value).toBe(
      '',
    ),
  );
});
