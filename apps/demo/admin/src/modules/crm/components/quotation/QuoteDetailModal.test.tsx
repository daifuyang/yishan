import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import {
  createQuotation,
  confirmQuotation,
  revokeQuotationConfirmation,
  createContract,
  reviseQuotation,
  createQuotationShare,
  deleteQuotation,
  getQuotation,
  listContactsByCustomer,
  revokeQuotationShare,
  sendQuotation,
  voidQuotation,
} from '@/services/crm';
import OpportunityAdvanceModal from '../opportunity/OpportunityAdvanceModal';
import QuoteDetailModal from './QuoteDetailModal';

type QuotationResp = import('@/services/crm').QuotationResp;

jest.mock('@/utils/permission', () => ({ usePermission: () => () => true }));
jest.mock('@/services/crm', () => ({
  getQuotation: jest.fn(),
  confirmQuotation: jest.fn(),
  revokeQuotationConfirmation: jest.fn(),
  createContract: jest.fn(),
  reviseQuotation: jest.fn(),
  listAllPages: jest.fn().mockResolvedValue([]),
  createQuotationShare: jest.fn(),
  revokeQuotationShare: jest.fn(),
  createQuotation: jest.fn(),
  listContactsByCustomer: jest.fn(),
  sendQuotation: jest.fn(),
  deleteQuotation: jest.fn(),
  voidQuotation: jest.fn(),
}));

class MessageChannelMock {
  port1 = { onmessage: null as ((event: MessageEvent) => void) | null };
  port2 = {
    postMessage: () =>
      setTimeout(() => this.port1.onmessage?.(new MessageEvent('message')), 0),
  };
}
globalThis.MessageChannel =
  MessageChannelMock as unknown as typeof MessageChannel;

globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
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

test('在同一个报价详情切换历史版本，历史草稿只读且不出现第二个详情弹窗', async () => {
  const versions = [
    { id: 2, quotationNo: 'Q-V2', version: 2, status: 'draft', totalCents: 6400000, quoteDate: quote.quoteDate, createdAt: quote.createdAt, shareFirstViewedAt: null, shareViewCount: 0, hasShare: false },
    { id: 1, quotationNo: quote.quotationNo, version: 1, status: 'draft', totalCents: 6600000, quoteDate: quote.quoteDate, createdAt: quote.createdAt, shareFirstViewedAt: null, shareViewCount: 0, hasShare: false },
  ];
  jest.mocked(getQuotation).mockImplementation(async (id) => ({
    ...quote, id, version: id, sourceQuoteId: id === 2 ? 1 : null,
    currentVersion: 2, versionCount: 2, seriesId: 'series-a', seriesNo: 'Q-20261006-0001',
    seriesTitle: quote.name, versions, hasShare: false, share: null,
    totalCents: id === 2 ? 6400000 : 6600000,
  }) as QuotationResp);
  render(React.createElement(QuoteDetailModal, { quotationId: 2, onClose: jest.fn() }));
  const history = await screen.findByText('V1');
  expect(screen.getByRole('button', { name: /编\s*辑/ })).toBeTruthy();
  fireEvent.click(history);
  await waitFor(() => expect(screen.queryByRole('button', { name: /编\s*辑/ })).toBeNull());
  expect(screen.queryByRole('button', { name: /分\s*享/ })).toBeNull();
  expect(screen.queryByRole('button', { name: '新版本' })).toBeNull();
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
  expect(screen.getAllByText('¥66,000').length).toBeGreaterThan(0);
  fireEvent.click(screen.getByText('V2'));
  await screen.findByRole('button', { name: /编\s*辑/ });
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
});
const originalStyle = window.getComputedStyle;
beforeAll(() => {
  window.getComputedStyle = (el) => originalStyle(el);
});
afterAll(() => {
  window.getComputedStyle = originalStyle;
});
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getQuotation).mockResolvedValue({
    ...quote,
    share: {
      id: 12,
      status: 'active',
      expiresAt: '2099-10-20T15:59:59Z',
      sentAt: null,
      firstViewedAt: null,
      lastViewedAt: null,
      viewCount: 0,
    },
  });
});

test('renders four manual snapshots, totals and version', async () => {
  render(
    React.createElement(QuoteDetailModal, {
      quotationId: 1,
      onClose: jest.fn(),
    }),
  );
  await screen.findByText('标准 CRM 基础方案');
  expect(screen.getByText('40账号方案')).toBeTruthy();
  expect(screen.getByText('门店企业客户服务记录定制')).toBeTruthy();
  expect(screen.getByText('实施及数据初始化')).toBeTruthy();
  expect(screen.getByText('小计')).toBeTruthy();
  expect(screen.getByText('¥70,000')).toBeTruthy();
  expect(screen.getByText('首期合作优惠')).toBeTruthy();
  expect(screen.getByText('-¥4,000')).toBeTruthy();
  expect(screen.getByText(quote.internalDiscountReason ?? '')).toBeTruthy();
  expect(screen.getAllByText('¥66,000').length).toBeGreaterThan(0);
  expect(screen.getByText('V1')).toBeTruthy();
});
test('only submits after confirmation and closes detail after a successful send', async () => {
  const changed = jest.fn();
  const close = jest.fn();
  jest.mocked(sendQuotation).mockResolvedValue({ ...quote, status: 'sent' });
  render(
    React.createElement(QuoteDetailModal, {
      quotationId: 1,
      onClose: close,
      onChanged: changed,
    }),
  );
  fireEvent.click(await screen.findByRole('button', { name: '发送报价' }));
  await screen.findAllByText('确认发送报价？');
  expect(sendQuotation).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '确认发送' }));
  await screen.findByText('已发送');
  expect(sendQuotation).toHaveBeenCalledWith(1, 12);
  expect(changed).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
  expect(screen.queryByRole('button', { name: '发送报价' })).toBeNull();
});
test('send failure retains draft detail and allows retry', async () => {
  jest.mocked(sendQuotation).mockRejectedValueOnce(new Error('发送事务失败'));
  const close = jest.fn();
  render(
    React.createElement(QuoteDetailModal, {
      quotationId: 1,
      onClose: close,
    }),
  );
  fireEvent.click(await screen.findByRole('button', { name: '发送报价' }));
  fireEvent.click(await screen.findByRole('button', { name: '确认发送' }));
  await screen.findByText('发送事务失败');
  expect(close).not.toHaveBeenCalled();
  expect(screen.getByText('草稿')).toBeTruthy();
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '确认发送' })).toBeTruthy(),
  );
});

test('sending from an opportunity closes quote detail and refreshes the stage action', async () => {
  jest.mocked(createQuotation).mockResolvedValue(quote);
  jest.mocked(sendQuotation).mockResolvedValue({ ...quote, status: 'sent' });
  jest.mocked(listContactsByCustomer).mockResolvedValue([
    {
      id: 15,
      customerId: 23,
      name: '张明远',
      isPrimary: 1,
    } as import('@/services/crm').ContactRow,
  ]);
  let changes = 0;
  function Workflow() {
    const [stage, setStage] =
      React.useState<import('@/services/crm').OpportunityRow['stage']>(
        'solution',
      );
    return React.createElement(OpportunityAdvanceModal, {
      opportunity: {
        id: 1,
        opportunityNo: 'OPP-202610-0001',
        customerId: 23,
        customerName: quote.customerName,
        primaryContactId: 15,
        name: quote.opportunityName ?? '',
        ownerId: 7,
        ownerName: '愚公',
        stage,
        products: [],
        amountCents: 6000000,
        expectedCloseDate: '2026-10-31',
      },
      onRefresh: () => {
        changes += 1;
        if (changes === 2) setStage('quotation');
      },
    });
  }
  render(React.createElement(Workflow));
  fireEvent.click(screen.getByRole('button', { name: /报\s*价/ }));
  await screen.findByText('新建报价');
  await waitFor(() =>
    expect(screen.getAllByText('张明远').length).toBeGreaterThan(0),
  );
  fireEvent.change(screen.getByRole('textbox', { name: '项目名称1' }), {
    target: { value: '实施服务' },
  });
  fireEvent.change(screen.getByRole('spinbutton', { name: '单价1' }), {
    target: { value: '100' },
  });
  fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }));
  fireEvent.click(await screen.findByRole('button', { name: '发送报价' }));
  fireEvent.click(await screen.findByRole('button', { name: '确认发送' }));
  await screen.findByRole('button', { name: /谈\s*判/ });
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
});

test('successful send closes detail even when the list refresh fails', async () => {
  jest.mocked(sendQuotation).mockResolvedValue({ ...quote, status: 'sent' });
  const close = jest.fn();
  render(React.createElement(QuoteDetailModal, {
    quotationId: 1, onClose: close,
    onChanged: async () => { throw new Error('刷新失败'); },
  }));
  fireEvent.click(await screen.findByRole('button', { name: '发送报价' }));
  fireEvent.click(await screen.findByRole('button', { name: '确认发送' }));
  await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
});

test('an existing share can be copied repeatedly after reopening detail without regeneration', async () => {
  const existing = await getQuotation(1);
  if (!existing.share) throw new Error('missing share fixture');
  jest.mocked(getQuotation).mockResolvedValue({ ...existing, share: {
    ...existing.share, url: '/q/existing-share',
  } } as QuotationResp);
  const copy = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true, value: { writeText: copy },
  });
  const view = render(React.createElement(QuoteDetailModal, { quotationId: 1, onClose: jest.fn() }));
  fireEvent.click(await screen.findByRole('button', { name: '复制' }));
  await waitFor(() => expect(copy).toHaveBeenCalledWith('http://localhost:8000/q/existing-share'));
  view.unmount();
  render(React.createElement(QuoteDetailModal, { quotationId: 1, onClose: jest.fn() }));
  fireEvent.click(await screen.findByRole('button', { name: '复制' }));
  await waitFor(() => expect(copy).toHaveBeenCalledTimes(2));
  expect(createQuotationShare).not.toHaveBeenCalled();
});

test('failed draft save retains form input and does not refresh the opportunity', async () => {
  jest.mocked(createQuotation).mockRejectedValueOnce(new Error('草稿保存失败'));
  jest.mocked(listContactsByCustomer).mockResolvedValue([
    {
      id: 15,
      customerId: 23,
      name: '张明远',
      isPrimary: 1,
    } as import('@/services/crm').ContactRow,
  ]);
  const refresh = jest.fn();
  render(
    React.createElement(OpportunityAdvanceModal, {
      opportunity: {
        id: 1,
        opportunityNo: 'OPP-202610-0001',
        customerId: 23,
        customerName: quote.customerName,
        primaryContactId: 15,
        name: quote.opportunityName ?? '',
        ownerId: 7,
        ownerName: '愚公',
        stage: 'solution',
        products: [],
        amountCents: 6000000,
        expectedCloseDate: '2026-10-31',
      },
      onRefresh: refresh,
    }),
  );
  fireEvent.click(screen.getByRole('button', { name: /报\s*价/ }));
  await screen.findByText('新建报价');
  await waitFor(() =>
    expect(screen.getAllByText('张明远').length).toBeGreaterThan(0),
  );
  fireEvent.change(screen.getByRole('textbox', { name: '项目名称1' }), {
    target: { value: '保留实施服务' },
  });
  fireEvent.change(screen.getByRole('spinbutton', { name: '单价1' }), {
    target: { value: '100' },
  });
  fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }));
  await screen.findByText('草稿保存失败');
  expect(
    (screen.getByRole('textbox', { name: '项目名称1' }) as HTMLInputElement)
      .value,
  ).toBe('保留实施服务');
  expect(screen.getByRole('button', { name: /保\s*存/ })).toBeTruthy();
  expect(refresh).not.toHaveBeenCalled();
});

test('no share keeps generation in the sharing section', async () => {
  jest.mocked(getQuotation).mockResolvedValue({ ...quote, share: null });
  render(
    React.createElement(QuoteDetailModal, {
      quotationId: 1,
      onClose: jest.fn(),
    }),
  );
  await screen.findByText('尚未生成客户分享链接');
  expect(screen.queryByText(/状态：/)).toBeNull();
  expect(screen.queryByRole('button', { name: '生成链接' })).toBeNull();
  expect(screen.getByRole('button', { name: /生\s*成/ })).toBeTruthy();
});
test.each(['expired', 'revoked'])(
  'renders abnormal share state %s without duplicate status fields',
  async (state) => {
    jest.mocked(getQuotation).mockResolvedValue({
      ...quote,
      share: {
        id: 12,
        status: state === 'revoked' ? 'revoked' : 'active',
        expiresAt:
          state === 'expired' ? '2020-01-01T00:00:00Z' : '2099-01-01T00:00:00Z',
        sentAt: null,
        firstViewedAt: null,
        lastViewedAt: null,
        viewCount: 0,
      },
    });
    render(
      React.createElement(QuoteDetailModal, {
        quotationId: 1,
        onClose: jest.fn(),
      }),
    );
    await screen.findByText(state === 'expired' ? '已过期' : '已停用');
    expect(screen.queryByText(/状态：已生成/)).toBeNull();
    expect(screen.getAllByRole('button', { name: '复制' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: '预览' })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: '重新生成' })).toBeNull();
  },
);
test('zero discount omits public description and internal reason', async () => {
  jest
    .mocked(getQuotation)
    .mockResolvedValue({ ...quote, discountAmountCents: 0 });
  render(
    React.createElement(QuoteDetailModal, {
      quotationId: 1,
      onClose: jest.fn(),
    }),
  );
  await screen.findByText('标准 CRM 基础方案');
  expect(screen.queryByText('首期合作优惠')).toBeNull();
  expect(screen.queryByText(quote.internalDiscountReason ?? '')).toBeNull();
});
test('generation follows quote validity and stays separate from sending', async () => {
  // A calendar-date fixture keeps this interaction assertion independent of the runner timezone.
  jest.mocked(getQuotation).mockResolvedValue({
    ...quote,
    validUntil: '2026-10-20',
    share: null,
  });
  jest.mocked(createQuotationShare).mockResolvedValue({
    shareId: 13,
    url: '/q/new-token',
    expiresAt: '2099-10-20T15:59:59Z',
  });
  const copy = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: copy },
  });
  render(
    React.createElement(QuoteDetailModal, {
      quotationId: 1,
      onClose: jest.fn(),
    }),
  );
  fireEvent.click(await screen.findByRole('button', { name: /生\s*成/ }));
  await screen.findByText(/跟随报价有效期（2026-10-20）/);
  expect(screen.getByText('有效至 2026-10-20 23:59')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '生成链接' }));
  await waitFor(() => expect(createQuotationShare).toHaveBeenCalled());
  expect(createQuotationShare).toHaveBeenCalledWith(1, {
    followQuoteValidUntil: true,
    replaceShareId: undefined,
  });
  expect(sendQuotation).not.toHaveBeenCalled();
  expect(
    (screen.getByRole('button', { name: '预览' }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: '复制' }));
  await waitFor(() =>
    expect(copy).toHaveBeenCalledWith(expect.stringContaining('/q/new-token')),
  );
  expect(screen.getAllByRole('button', { name: '复制' })).toHaveLength(1);
});

test('internal preview works without a customer share URL', async () => {
  const open = jest.spyOn(window, 'open').mockImplementation(() => null);
  jest.mocked(getQuotation).mockResolvedValue({ ...quote, share: null });
  render(
    React.createElement(QuoteDetailModal, {
      quotationId: 1,
      onClose: jest.fn(),
    }),
  );
  fireEvent.click(await screen.findByRole('button', { name: '预览' }));
  expect(open).toHaveBeenLastCalledWith(
    '/q/preview?preview=1&quotationId=1',
    '_blank',
    'noopener,noreferrer',
  );
  open.mockRestore();
});

test('returning from preview refreshes publication state and locks the draft editor', async () => {
  jest.mocked(getQuotation).mockResolvedValueOnce({ ...quote, share: null, hasShare: false });
  render(React.createElement(QuoteDetailModal, { quotationId: 1, onClose: jest.fn() }));
  await screen.findByRole('button', { name: /编\s*辑/ });
  fireEvent(window, new Event('focus'));
  await screen.findByRole('button', { name: '发送报价' });
  expect(screen.queryByRole('button', { name: /编\s*辑/ })).toBeNull();
  expect(screen.queryByRole('button', { name: '新版本' })).toBeNull();
});

test('generated draft cannot create another version before sending', async () => {
  render(React.createElement(QuoteDetailModal, { quotationId: 1, onClose: jest.fn() }));
  await screen.findByRole('button', { name: '发送报价' });
  expect(screen.queryByRole('button', { name: '新版本' })).toBeNull();
});
test('regeneration confirms and requests atomic replacement', async () => {
  jest.mocked(createQuotationShare).mockResolvedValue({
    shareId: 14,
    url: '/q/replacement-token',
    expiresAt: '2099-10-20T15:59:59Z',
  });
  render(
    React.createElement(QuoteDetailModal, {
      quotationId: 1,
      onClose: jest.fn(),
    }),
  );
  fireEvent.click(await screen.findByRole('button', { name: '更多分享操作' }));
  fireEvent.click(await screen.findByText('重新生成'));
  await screen.findByText('生成新链接后，当前链接将停止访问。');
  expect(createQuotationShare).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '重新生成' }));
  fireEvent.click(await screen.findByRole('button', { name: '生成链接' }));
  await waitFor(() =>
    expect(createQuotationShare).toHaveBeenCalledWith(1, {
      followQuoteValidUntil: true,
      replaceShareId: 12,
    }),
  );
  expect(revokeQuotationShare).not.toHaveBeenCalled();
});
test('revocation stays in More and requires confirmation', async () => {
  jest.mocked(revokeQuotationShare).mockResolvedValue(undefined);
  render(
    React.createElement(QuoteDetailModal, {
      quotationId: 1,
      onClose: jest.fn(),
    }),
  );
  fireEvent.click(await screen.findByRole('button', { name: '更多分享操作' }));
  fireEvent.click(await screen.findByText('停用'));
  await screen.findByText('停用后客户将无法继续通过当前链接查看报价。');
  expect(revokeQuotationShare).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: /停\s*用/ }));
  await screen.findByText('已停用');
  expect(revokeQuotationShare).toHaveBeenCalledWith(1, 12);
  expect(
    (screen.getByRole('button', { name: '复制' }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
});

test('deleting an unshared draft closes detail instead of reloading the deleted quote', async () => {
  jest
    .mocked(getQuotation)
    .mockResolvedValue({ ...quote, hasShare: false, share: null });
  jest.mocked(deleteQuotation).mockResolvedValue(undefined);
  const close = jest.fn();
  render(
    React.createElement(QuoteDetailModal, { quotationId: 1, onClose: close }),
  );
  fireEvent.click(await screen.findByRole('button', { name: '更多报价操作' }));
  fireEvent.click(await screen.findByRole('menuitem', { name: '删除' }));
  expect(deleteQuotation).not.toHaveBeenCalled();
  fireEvent.click(await screen.findByRole('button', { name: /删\s*除/ }));
  await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
  expect(deleteQuotation).toHaveBeenCalledWith(1);
  expect(getQuotation).toHaveBeenCalledTimes(1);
});

test('void uses a reason form and retains entered reason when the existing API fails', async () => {
  jest.mocked(getQuotation).mockResolvedValue({ ...quote, status: 'sent' });
  jest.mocked(voidQuotation).mockRejectedValue(new Error('作废失败，请重试'));
  render(
    React.createElement(QuoteDetailModal, {
      quotationId: 1,
      onClose: jest.fn(),
    }),
  );
  fireEvent.click(await screen.findByRole('button', { name: '更多报价操作' }));
  fireEvent.click(await screen.findByRole('menuitem', { name: '作废' }));
  const reason = await screen.findByLabelText('作废原因');
  expect(voidQuotation).not.toHaveBeenCalled();
  fireEvent.change(reason, { target: { value: '报价范围有误' } });
  fireEvent.click(screen.getByRole('button', { name: /作\s*废/ }));
  await screen.findByText('作废失败，请重试');
  expect(voidQuotation).toHaveBeenCalledWith(1, '报价范围有误');
  expect((reason as HTMLTextAreaElement).value).toBe('报价范围有误');
});

test('sent quote has one new-version entry and opens the new draft editor', async () => {
  const changed = jest.fn();
  const draft = {
    ...quote,
    id: 2,
    version: 2,
    rootQuoteId: 1,
    sourceQuoteId: 1,
    name: '禾味餐饮 CRM 数字化项目第二版报价',
    status: 'draft' as const,
    hasShare: false,
    share: null,
  };
  jest
    .mocked(getQuotation)
    .mockImplementation(async (id) =>
      id === 2 ? draft : { ...quote, status: 'sent', hasShare: true },
    );
  jest.mocked(reviseQuotation).mockResolvedValue(draft);
  jest.mocked(listContactsByCustomer).mockResolvedValue([]);
  render(
    React.createElement(QuoteDetailModal, {
      quotationId: 1,
      onClose: jest.fn(),
      onChanged: changed,
    }),
  );
  await screen.findByText(quote.name);
  expect(screen.queryByRole('button', { name: '新版本' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '更多报价操作' }));
  const create = await screen.findByText('新版本');
  fireEvent.click(create);
  await screen.findByText('编辑报价');
  await waitFor(() =>
    expect(
      screen.getByRole('textbox', { name: '报价名称' }).getAttribute('value'),
    ).toBe('禾味餐饮 CRM 数字化项目第二版报价'),
  );
  expect(reviseQuotation).toHaveBeenCalledWith(1);
  expect(changed).not.toHaveBeenCalled();
  expect(screen.getAllByRole('button', { name: /保\s*存/ })).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: /取\s*消/ }));
  await waitFor(() => expect(changed).toHaveBeenCalled());
});


test('sent quote confirms through a second modal and immediately offers the existing contract form', async () => {
  const sent = { ...quote, status: 'sent' as const, hasShare: true, contractId: null };
  const accepted = { ...sent, status: 'accepted' as const, acceptedBy: 7 };
  jest.mocked(getQuotation).mockResolvedValue(sent);
  jest.mocked(confirmQuotation).mockResolvedValue(accepted);
  render(React.createElement(QuoteDetailModal, { quotationId: 1, onClose: jest.fn() }));
  fireEvent.click(await screen.findByRole('button', { name: '确认报价' }));
  expect(confirmQuotation).not.toHaveBeenCalled();
  expect(await screen.findByText('确认客户已接受当前 V1 报价？')).toBeTruthy();
  jest.mocked(getQuotation).mockResolvedValue(accepted);
  const confirmButton = screen.getAllByRole('button', { name: '确认报价' }).at(-1);
  if (!confirmButton) throw new Error('确认按钮未显示');
  fireEvent.click(confirmButton);
  await waitFor(() => expect(confirmQuotation).toHaveBeenCalledWith(1));
  fireEvent.click(await screen.findByRole('button', { name: '生成合同' }));
  await screen.findByText('新建合同');
  expect(createContract).not.toHaveBeenCalled();
  expect(screen.getByRole('textbox', { name: '合同名称' }).getAttribute('value')).toBe('禾味餐饮 CRM 数字化项目合同');
  expect(screen.getByRole('spinbutton', { name: '合同金额' }).getAttribute('value')).toBe('66000.00');
});

test('revocation requires a reason and refreshes the sent footer without deleting viewing data', async () => {
  const accepted = { ...quote, status: 'accepted' as const, hasShare: true, contractId: null };
  jest.mocked(getQuotation).mockResolvedValue(accepted);
  jest.mocked(revokeQuotationConfirmation).mockResolvedValue({ ...accepted, status: 'sent' });
  render(React.createElement(QuoteDetailModal, { quotationId: 1, onClose: jest.fn() }));
  await screen.findByRole('button', { name: '生成合同' });
  fireEvent.click(screen.getByRole('button', { name: '更多报价操作' }));
  fireEvent.click(await screen.findByText('撤销确认'));
  await screen.findByText('撤销报价确认');
  expect(revokeQuotationConfirmation).not.toHaveBeenCalled();
  fireEvent.mouseDown(screen.getByRole('combobox', { name: '原因' }));
  fireEvent.click(await screen.findByText('误操作'));
  jest.mocked(getQuotation).mockResolvedValue({ ...accepted, status: 'sent' });
  fireEvent.click(screen.getByRole('button', { name: '撤销确认' }));
  await waitFor(() => expect(revokeQuotationConfirmation).toHaveBeenCalledWith(1, expect.objectContaining({ reason: 'mistake' })));
  await screen.findByRole('button', { name: '确认报价' });
});

test('a linked contract blocks duplicate contract entry and hides revocation', async () => {
  jest.mocked(getQuotation).mockResolvedValue({ ...quote, status: 'accepted', hasShare: true, contractId: 31 });
  render(React.createElement(QuoteDetailModal, { quotationId: 1, onClose: jest.fn() }));
  fireEvent.click(await screen.findByRole('button', { name: '生成合同' }));
  await screen.findByText('当前报价已生成合同');
  expect(screen.queryByText('新建合同')).toBeNull();
  expect(createContract).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '更多报价操作' }));
  expect(screen.queryByText('撤销确认')).toBeNull();
});
