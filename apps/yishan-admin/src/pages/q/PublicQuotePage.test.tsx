import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { request, useLocation, useParams } from '@umijs/max';
import React from 'react';
import { usePermission } from '@/utils/permission';
import PublicQuotePage from './[token]';

jest.mock('@/utils/permission', () => ({ usePermission: jest.fn() }));
jest.mock('@umijs/max', () => ({
  request: jest.fn(),
  useParams: jest.fn(),
  useLocation: jest.fn(),
}));
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(usePermission).mockReturnValue(() => true);
  jest.mocked(useParams).mockReturnValue({ token: 'test-token' });
  jest.mocked(useLocation).mockReturnValue({
    pathname: '/q/test-token',
    search: '',
    hash: '',
    state: null,
    key: 'test',
  });
});

function mockInternalPreview(version = 2, allowed = true) {
  jest.mocked(usePermission).mockReturnValue(() => allowed);
  jest.mocked(useParams).mockReturnValue({ token: 'preview' });
  jest.mocked(useLocation).mockReturnValue({
    pathname: '/q/preview',
    search: '?quotationId=3',
    hash: '',
    state: null,
    key: 'test',
  });
  jest.mocked(request).mockImplementation(async (url) => ({
    data: url.endsWith('/preview')
      ? quote
      : {
          id: 3,
          version,
          currentVersion: 2,
          status: 'draft',
          share: null,
        },
  }));
}

test('internal preview generates a link in place and then offers copy without a customer preview button', async () => {
  mockInternalPreview();
  const copy = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: copy },
  });
  render(React.createElement(PublicQuotePage));
  const generate = await screen.findByRole('button', { name: /生\s*成/ });
  expect(screen.queryByRole('button', { name: '复制' })).toBeNull();
  jest.mocked(request).mockResolvedValueOnce({
    data: {
      shareId: 15,
      url: '/q/generated-token',
      expiresAt: '2099-10-14T15:59:59Z',
    },
  });
  fireEvent.click(generate);
  fireEvent.click(await screen.findByRole('button', { name: '复制' }));
  await waitFor(() =>
    expect(copy).toHaveBeenCalledWith(
      expect.stringContaining('/q/generated-token'),
    ),
  );
  expect(screen.queryByRole('button', { name: '客户预览' })).toBeNull();
  expect(screen.queryByRole('button', { name: /生\s*成/ })).toBeNull();
  expect(screen.getByText(quote.quoteTitle)).toBeTruthy();
  expect(
    jest.mocked(request).mock.calls.some(([url]) => url.endsWith('/send')),
  ).toBe(false);
});

test('remarks preserve decimal numbers and dates while removing existing list markers', async () => {
  jest.mocked(request).mockResolvedValue({
    data: {
      state: 'ok',
      quote: {
        ...quote,
        remark:
          '3.5% 的付款手续费由客户承担。\n2026.10.07 起实施。\n1) 首款确认后实施。\n• 服务记录作为定制内容。',
      },
    },
  });
  render(React.createElement(PublicQuotePage));
  const remarks = await screen.findByRole('region', { name: '备注' });
  expect(
    within(remarks)
      .getAllByRole('listitem')
      .map((item) => item.textContent),
  ).toEqual([
    '3.5% 的付款手续费由客户承担。',
    '2026.10.07 起实施。',
    '首款确认后实施。',
    '服务记录作为定制内容。',
  ]);
});

test.each([
  [1, true],
  [2, false],
])(
  'preview V%s with send permission %s stays read only',
  async (version, allowed) => {
    mockInternalPreview(version, allowed);
    render(React.createElement(PublicQuotePage));
    await screen.findByText(quote.quoteTitle);
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('button', { name: /生\s*成/ })).toBeNull();
  },
);

test('reopening an internal preview retains copy access to its existing customer link', async () => {
  mockInternalPreview();
  jest.mocked(request).mockImplementation(async (url) => ({
    data: url.endsWith('/preview')
      ? quote
      : {
          id: 3,
          version: 2,
          currentVersion: 2,
          status: 'sent',
          share: {
            id: 15,
            status: 'active',
            url: '/q/existing-token',
            expiresAt: '2099-10-14T15:59:59Z',
          },
        },
  }));
  const copy = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: copy },
  });
  render(React.createElement(PublicQuotePage));
  fireEvent.click(await screen.findByRole('button', { name: '复制' }));
  await waitFor(() =>
    expect(copy).toHaveBeenCalledWith('http://localhost:8000/q/existing-token'),
  );
  expect(request).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole('button', { name: /生\s*成/ })).toBeNull();
});
const quote = {
  companyName: '亦山',
  quoteTitle: '禾味餐饮 CRM 数字化项目第一版报价',
  quoteNumber: 'Q-1',
  quoteDate: '2026-10-07',
  validUntil: '2026-10-14',
  customerName: '上海禾味餐饮管理有限公司',
  contactDisplayName: '张明远',
  items: [
    {
      name: '标准 CRM 基础方案',
      description: null,
      quantity: 1,
      unit: '套',
      unitPriceCents: 7000000,
      amountCents: 7000000,
    },
  ],
  subtotalCents: 7000000,
  discountAmountCents: 400000,
  publicDiscountDescription: '首期合作优惠',
  internalDiscountReason:
    '客户同时对比两家CRM供应商，为推进首次合作给予竞争性报价。',
  totalAmountCents: 6600000,
  remark: null,
  salesContactName: '愚公',
  salesContactPhone: null,
  version: 1,
};

test('customer document keeps contact details above the items and closes with numbered remarks', async () => {
  const remark =
    '1. 标准 CRM 范围以需求清单为准。\n2. 门店企业客户服务记录作为本期定制内容。\n3. 最终实施范围以双方确认的合同为准。';
  jest
    .mocked(request)
    .mockResolvedValue({ data: { state: 'ok', quote: { ...quote, remark } } });
  render(React.createElement(PublicQuotePage));
  const document = await screen.findByRole('article', {
    name: quote.quoteTitle,
  });
  const content = within(document);
  expect(content.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  expect(content.getByText('13816885621')).toBeTruthy();
  expect(content.getByText('联系电话')).toBeTruthy();
  expect(content.getAllByText(quote.quoteNumber)).toHaveLength(1);
  expect(content.getAllByText('2026/10/07')).toHaveLength(1);
  expect(content.getAllByText('2026/10/14')).toHaveLength(1);
  expect(content.queryByText('报价信息')).toBeNull();
  expect(content.queryByText('报价说明')).toBeNull();
  expect(content.queryByText(/^致：/)).toBeNull();
  expect(content.queryByText('报价单')).toBeNull();
  expect(
    content
      .getByText('13816885621')
      .compareDocumentPosition(content.getByRole('table')) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  const remarks = content.getByRole('region', { name: '备注' });
  expect(
    within(remarks)
      .getAllByRole('listitem')
      .map((item) => item.textContent),
  ).toEqual([
    '标准 CRM 范围以需求清单为准。',
    '门店企业客户服务记录作为本期定制内容。',
    '最终实施范围以双方确认的合同为准。',
  ]);
});

test.each([
  ['上海禾味餐饮管理有限公司', '愚公', '13900001234', '13900001234'],
  ['其他客户', '愚公', null, null],
  ['上海禾味餐饮管理有限公司', '其他销售', null, null],
])(
  'sales phone prefers API data and the sandbox fallback stays scoped to %s / %s',
  async (customerName, salesContactName, salesContactPhone, expectedPhone) => {
    jest.mocked(request).mockResolvedValue({
      data: {
        state: 'ok',
        quote: {
          ...quote,
          customerName,
          salesContactName,
          salesContactPhone,
        },
      },
    });
    render(React.createElement(PublicQuotePage));
    await screen.findByText(quote.quoteTitle);
    expect(screen.queryByText('13816885621')).toBeNull();
    if (expectedPhone) expect(screen.getByText(expectedPhone)).toBeTruthy();
  },
);
test('public discount description replaces the label; internal content is never rendered', async () => {
  jest.mocked(request).mockResolvedValue({ data: { state: 'ok', quote } });
  render(React.createElement(PublicQuotePage));
  await screen.findByText('首期合作优惠');
  expect(screen.getByText('-¥4,000')).toBeTruthy();
  expect(screen.getAllByText('¥66,000')).toHaveLength(2);
  expect(screen.queryByText(quote.internalDiscountReason)).toBeNull();
});
test.each([0, 400000])(
  'discount visibility and fallback for %s',
  async (discountAmountCents) => {
    jest.mocked(request).mockResolvedValue({
      data: {
        state: 'ok',
        quote: {
          ...quote,
          discountAmountCents,
          publicDiscountDescription: null,
        },
      },
    });
    render(React.createElement(PublicQuotePage));
    await screen.findByText(quote.quoteTitle);
    expect(Boolean(screen.queryByText('优惠'))).toBe(discountAmountCents > 0);
  },
);

test('internal preview reads the protected endpoint and can print without exposing internal content', async () => {
  jest.mocked(useParams).mockReturnValue({ token: 'preview' });
  jest.mocked(useLocation).mockReturnValue({
    pathname: '/q/preview',
    search: '?preview=1&quotationId=3',
    hash: '',
    state: null,
    key: 'test',
  });
  jest.mocked(request).mockResolvedValue({ data: quote });
  const print = jest.spyOn(window, 'print').mockImplementation(() => {});
  render(React.createElement(PublicQuotePage));
  fireEvent.click(
    await screen.findByRole('button', { name: '打印 / 导出 PDF' }),
  );
  expect(request).toHaveBeenCalledTimes(2);
  expect(request).toHaveBeenCalledWith(
    '/api/crm/v1/quotations/3/preview',
    expect.anything(),
  );
  expect(print).toHaveBeenCalledTimes(1);
  expect(screen.getByText(/内部预览，不计入客户查看/)).toBeTruthy();
  expect(screen.queryByText(quote.internalDiscountReason)).toBeNull();
  print.mockRestore();
});

test('print link opens the print dialog once after the document is ready', async () => {
  jest.mocked(useParams).mockReturnValue({ token: 'preview' });
  jest.mocked(useLocation).mockReturnValue({
    pathname: '/q/preview',
    search: '?preview=1&quotationId=3&print=1',
    hash: '',
    state: null,
    key: 'test',
  });
  jest.mocked(request).mockResolvedValue({ data: quote });
  const print = jest.spyOn(window, 'print').mockImplementation(() => {});
  render(React.createElement(PublicQuotePage));
  await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
  print.mockRestore();
});

test('unauthorized internal preview never falls back to the customer link', async () => {
  jest.mocked(useParams).mockReturnValue({ token: 'preview' });
  jest.mocked(useLocation).mockReturnValue({
    pathname: '/q/preview',
    search: '?preview=1&quotationId=3',
    hash: '',
    state: null,
    key: 'test',
  });
  jest.mocked(request).mockRejectedValue(new Error('Unauthorized'));
  render(React.createElement(PublicQuotePage));
  await screen.findByText('请登录 CRM 并确认报价访问权限后重试。');
  expect(request).toHaveBeenCalledTimes(2);
  expect(screen.queryByText(quote.quoteTitle)).toBeNull();
});
