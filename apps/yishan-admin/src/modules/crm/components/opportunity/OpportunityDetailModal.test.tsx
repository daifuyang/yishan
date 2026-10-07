import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import React from 'react';
import {
  advanceOpportunityStage,
  getQuotation,
  listContracts,
  listQuotations,
} from '@/services/crm';

type OpportunityRow = import('@/services/crm').OpportunityRow;
type QuotationRow = import('@/services/crm').QuotationRow;
type QuoteSeriesSummary = import('@/services/crm').QuoteSeriesSummary;

import OpportunityDetailModal from './OpportunityDetailModal';

jest.mock('@/utils/permission', () => ({ usePermission: () => () => true }));
jest.mock('@/services/crm', () => ({
  advanceOpportunityStage: jest.fn(),
  getQuotation: jest.fn(),
  createQuotation: jest.fn(),
  sendQuotation: jest.fn(),
  listContactsByCustomer: jest
    .fn()
    .mockResolvedValue([{ id: 15, name: '张明远' }]),
  listQuotations: jest.fn().mockResolvedValue({ data: [], total: 0 }),
  listContracts: jest.fn().mockResolvedValue({ data: [], total: 0 }),
  listActivitiesByCustomer: jest.fn().mockResolvedValue({ items: [], total: 0 }),
  listAllPages: (
    load: (page: number, size: number) => Promise<{ data: unknown[] }>,
  ) => load(1, 100).then((result) => result.data),
}));

const opportunity: OpportunityRow = {
  id: 5,
  opportunityNo: 'OPP-202610-0001',
  name: '禾味餐饮 CRM 数字化项目',
  customerId: 7,
  customerName: '上海禾味餐饮管理有限公司',
  stage: 'solution',
  amountCents: 6000000,
  expectedCloseDate: '2026-10-31',
  ownerName: '愚公',
  ownerId: 1,
  primaryContactId: 15,
  sourceId: 3,
  products: [],
  requirement: '统一客户与销售管理',
};

const quotation: QuotationRow = {
  id: 21,
  quotationNo: 'QT-20261007-001',
  name: 'CRM 标准方案',
  version: 1,
  rootQuoteId: 1,
  sourceQuoteId: null,
  customerId: 7,
  opportunityId: 5,
  contactId: 15,
  opportunityName: opportunity.name,
  contactName: '张明远',
  quoteDate: '2026-10-07T00:00:00Z',
  ownerUserId: 1,
  ownerUserName: '愚公',
  ownerDepartmentId: null,
  customerName: opportunity.customerName ?? null,
  status: 'sent',
  validUntil: '2026-10-31T00:00:00Z',
  netCents: 6000000,
  taxCents: 0,
  totalCents: 6000000,
  discountAmountCents: 0,
  remark: null,
  creatorId: 1,
  updaterId: 1,
  createdAt: '2026-10-07T00:00:00Z',
  updatedAt: '2026-10-07T00:00:00Z',
  sentAt: '2026-10-07T00:00:00Z',
  acceptedAt: null,
  closedAt: null,
};

const quotationSeries = (
  overrides: Partial<QuoteSeriesSummary> = {},
): QuoteSeriesSummary => ({
  seriesId: 'series-1',
  seriesNo: 'Q-20261007-0001',
  title: 'CRM 标准方案报价',
  customerId: opportunity.customerId,
  opportunityId: opportunity.id,
  opportunityName: opportunity.name,
  opportunityNo: opportunity.opportunityNo,
  currentQuoteId: quotation.id,
  currentVersion: 1,
  versionCount: 1,
  currentStatus: 'sent',
  currentAmount: quotation.totalCents,
  quoteDate: quotation.quoteDate,
  validUntil: quotation.validUntil,
  customerViewStatus: 'viewed',
  lastViewedAt: '2026-10-07T00:00:00Z',
  ownerUserName: quotation.ownerUserName,
  hasActiveShare: true,
  ...overrides,
});

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

const originalGetComputedStyle = window.getComputedStyle;
beforeAll(() => {
  window.getComputedStyle = (element) => originalGetComputedStyle(element);
});
afterAll(() => {
  window.getComputedStyle = originalGetComputedStyle;
});
beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(listQuotations)
    .mockReset()
    .mockResolvedValue({ data: [], total: 0 });
});

async function quotationListDialog() {
  const list = (await screen.findByText('关联报价')).closest('[role="dialog"]');
  if (!(list instanceof HTMLElement)) throw new Error('关联报价列表未打开');
  return list;
}

test('detail resolves contact and offers only one stage action in the footer', async () => {
  const close = jest.fn();
  render(
    React.createElement(OpportunityDetailModal, {
      opportunity,
      open: true,
      onClose: close,
      onRefresh: jest.fn(),
    }),
  );
  await screen.findByText(/OPP-202610-0001.*上海禾味餐饮管理有限公司.*张明远/);
  expect(screen.getByText('¥60,000')).toBeTruthy();
  expect(screen.getByText('2026-10-31')).toBeTruthy();
  expect(screen.getByText('愚公')).toBeTruthy();
  expect(screen.getAllByRole('button', { name: /报\s*价/ })).toHaveLength(1);
  expect(document.querySelector('.ant-descriptions')).toBeNull();
  expect(document.querySelector('.ant-empty')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /关\s*闭/ }));
  expect(close).toHaveBeenCalledTimes(1);
});

test('quotation opens draft form without advancing or showing a stage confirmation', async () => {
  render(
    React.createElement(OpportunityDetailModal, {
      opportunity,
      open: true,
      onClose: jest.fn(),
      onRefresh: jest.fn(),
    }),
  );
  fireEvent.click(screen.getByRole('button', { name: /报\s*价/ }));
  await screen.findByText('新建报价');
  expect(screen.queryByText('确认进入报价？')).toBeNull();
  expect(advanceOpportunityStage).not.toHaveBeenCalled();
});

test('a denied contract query does not discard the resolved contact or quotation count', async () => {
  jest.mocked(listContracts).mockRejectedValueOnce(new Error('无合同查看权限'));
  render(
    React.createElement(OpportunityDetailModal, {
      opportunity,
      open: true,
      onClose: jest.fn(),
      onRefresh: jest.fn(),
    }),
  );
  await screen.findByText(/OPP-202610-0001.*上海禾味餐饮管理有限公司.*张明远/);
  expect(screen.getByText('查看报价（0）')).toBeTruthy();
});

test.each([
  ['needs_confirmation', /方\s*案/],
  ['solution', /报\s*价/],
  ['quotation', /谈\s*判/],
] as const)('stage %s exposes its business action', async (stage, label) => {
  render(
    React.createElement(OpportunityDetailModal, {
      opportunity: { ...opportunity, stage },
      open: true,
      onClose: jest.fn(),
      onRefresh: jest.fn(),
    }),
  );
  await screen.findByText(/OPP-202610-0001.*上海禾味餐饮管理有限公司.*张明远/);
  expect(screen.getByRole('button', { name: label })).toBeTruthy();
});

test.each(['negotiation', 'won', 'lost'] as const)(
  'stage %s only offers close',
  async (stage) => {
    render(
      React.createElement(OpportunityDetailModal, {
        opportunity: { ...opportunity, stage },
        open: true,
        onClose: jest.fn(),
        onRefresh: jest.fn(),
      }),
    );
    await screen.findByText(/OPP-202610-0001.*上海禾味餐饮管理有限公司.*张明远/);
    expect(
      screen.queryByRole('button', { name: /方\s*案|报\s*价|谈\s*判/ }),
    ).toBeNull();
    expect(screen.getByRole('button', { name: /关\s*闭/ })).toBeTruthy();
  },
);

test('a failed advance keeps confirmation open and permits retry', async () => {
  jest
    .mocked(advanceOpportunityStage)
    .mockRejectedValueOnce(new Error('商机已变化，请重试'));
  render(
    React.createElement(OpportunityDetailModal, {
      opportunity: { ...opportunity, stage: 'quotation' },
      open: true,
      onClose: jest.fn(),
      onRefresh: jest.fn(),
    }),
  );
  fireEvent.click(screen.getByRole('button', { name: /谈\s*判/ }));
  fireEvent.click(await screen.findByRole('button', { name: /^确\s*认$/ }));
  await screen.findByText('商机已变化，请重试');
  expect(screen.getByRole('button', { name: /^确\s*认$/ })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /取\s*消/ }));
});

test.each([1, 2])(
  '%s quotations open a list before selecting a detail',
  async (count) => {
    const quotes = [
      quotation,
      { ...quotation, id: 22, name: 'CRM 定制方案', status: 'draft' as const },
    ].slice(0, count);
    jest
      .mocked(listQuotations)
      .mockResolvedValueOnce({
        data: [quotationSeries({ currentStatus: 'sent', customerViewStatus: 'viewed' })],
        total: count,
      })
      .mockResolvedValueOnce({
        data: quotes.map((row, index) => quotationSeries({
          seriesId: `series-${index + 1}`,
          seriesNo: `Q-20261007-000${index + 1}`,
          title: row.name,
          currentQuoteId: row.id,
          currentStatus: row.status,
          currentVersion: index + 1,
          versionCount: index + 1,
          customerViewStatus: index === 0 ? 'viewed' : 'unviewed',
        })),
        total: count,
      });
    jest
      .mocked(getQuotation)
      .mockResolvedValueOnce({ ...quotation, publicDiscountDescription: null, internalDiscountReason: null, items: [] });
    render(
      React.createElement(OpportunityDetailModal, {
        opportunity,
        open: true,
        onClose: jest.fn(),
        onRefresh: jest.fn(),
      }),
    );
    fireEvent.click(await screen.findByText(`查看报价（${count}）`));
    const list = (await screen.findByText('关联报价')).closest(
      '[role="dialog"]',
    );
    if (!(list instanceof HTMLElement)) throw new Error('关联报价列表未打开');
    expect(await within(list).findByText('CRM 标准方案')).toBeTruthy();
    expect(within(list).getByText('已发送')).toBeTruthy();
    expect(within(list).getByText(/Q-20261007-0001 · V1 · 共1版/)).toBeTruthy();
    expect(within(list).queryByText('其他商机报价')).toBeNull();
    if (count === 2)
      expect(within(list).getByText('CRM 定制方案')).toBeTruthy();
    expect(getQuotation).not.toHaveBeenCalled();
    fireEvent.click(within(list).getByText('CRM 标准方案'));
    expect(await screen.findByText('报价明细')).toBeTruthy();
    expect(getQuotation).toHaveBeenCalledWith(21);
    const detail = screen.getByText('报价明细').closest('[role="dialog"]');
    if (!detail) throw new Error('报价详情未打开');
    fireEvent.click(
      within(detail as HTMLElement).getByRole('button', { name: /关\s*闭/ }),
    );
    expect(await screen.findByText('关联报价')).toBeTruthy();
  },
);

test('quotation count and pages are requested for the current opportunity on the server', async () => {
  const quotes = Array.from({ length: 25 }, (_, index) =>
    quotationSeries({
      seriesId: `series-${index + 1}`,
      seriesNo: `Q-20261007-${String(index + 1).padStart(4, '0')}`,
      title: `分页报价 ${index + 1}`,
      currentQuoteId: 100 + index,
    }),
  );
  jest.mocked(listQuotations).mockImplementation(async (query) => {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    return {
      data: quotes.slice((page - 1) * pageSize, page * pageSize),
      total: 25,
    };
  });
  render(
    React.createElement(OpportunityDetailModal, {
      opportunity,
      open: true,
      onClose: jest.fn(),
      onRefresh: jest.fn(),
    }),
  );
  const entry = await screen.findByText('查看报价（25）');
  expect(listQuotations).toHaveBeenCalledTimes(1);
  expect(listQuotations).toHaveBeenCalledWith({
    customerId: 7,
    opportunityId: 5,
    page: 1,
    pageSize: 1,
  });
  fireEvent.click(entry);
  const list = await quotationListDialog();
  await within(list).findByText('分页报价 1');
  expect(within(list).queryByText('分页报价 11')).toBeNull();
  expect(listQuotations).toHaveBeenLastCalledWith({
    customerId: 7,
    opportunityId: 5,
    page: 1,
    pageSize: 10,
  });
  fireEvent.click(within(list).getByTitle('2'));
  await within(list).findByText('分页报价 11');
  expect(within(list).queryByText('分页报价 1')).toBeNull();
  expect(listQuotations).toHaveBeenLastCalledWith({
    customerId: 7,
    opportunityId: 5,
    page: 2,
    pageSize: 10,
  });
  expect(screen.getByText('查看报价（25）')).toBeTruthy();
});

test('an empty server page shows the quotation empty state', async () => {
  render(
    React.createElement(OpportunityDetailModal, {
      opportunity,
      open: true,
      onClose: jest.fn(),
      onRefresh: jest.fn(),
    }),
  );
  fireEvent.click(await screen.findByText('查看报价（0）'));
  const list = await quotationListDialog();
  await within(list).findByText('暂无报价单');
  await waitFor(() =>
    expect(listQuotations).toHaveBeenCalledWith({
      customerId: 7,
      opportunityId: 5,
      page: 1,
      pageSize: 10,
    }),
  );
});

test('a failed quotation page can retry the same page', async () => {
  let failSecondPage = true;
  jest.mocked(listQuotations).mockImplementation(async (query) => {
    if (query.page === 2 && failSecondPage) {
      failSecondPage = false;
      throw new Error('网络中断');
    }
    return {
      data: [quotationSeries({ title: `报价第 ${query.page ?? 1} 页` })],
      total: 25,
    };
  });
  render(
    React.createElement(OpportunityDetailModal, {
      opportunity,
      open: true,
      onClose: jest.fn(),
      onRefresh: jest.fn(),
    }),
  );
  fireEvent.click(await screen.findByText('查看报价（25）'));
  const list = await quotationListDialog();
  await within(list).findByText('报价第 1 页');
  fireEvent.click(within(list).getByTitle('2'));
  await within(list).findByText('报价加载失败，请重试');
  fireEvent.click(within(list).getByRole('button', { name: /重\s*试/ }));
  await within(list).findByText('报价第 2 页');
  expect(within(list).queryByText('报价加载失败，请重试')).toBeNull();
  expect(listQuotations).toHaveBeenLastCalledWith({
    customerId: 7,
    opportunityId: 5,
    page: 2,
    pageSize: 10,
  });
});

test('successful advance closes confirmation while related data is still refreshing', async () => {
  const updated: OpportunityRow = { ...opportunity, stage: 'negotiation' };
  jest.mocked(advanceOpportunityStage).mockResolvedValueOnce(updated);
  let finishRefresh: (() => void) | undefined;
  const refreshing = new Promise<void>((resolve) => {
    finishRefresh = resolve;
  });
  const onRefresh = jest.fn(() => refreshing);
  render(
    React.createElement(OpportunityDetailModal, {
      opportunity: { ...opportunity, stage: 'quotation' },
      open: true,
      onClose: jest.fn(),
      onRefresh,
    }),
  );
  fireEvent.click(screen.getByRole('button', { name: /谈\s*判/ }));
  fireEvent.click(await screen.findByRole('button', { name: /^确\s*认$/ }));
  try {
    await waitFor(() => expect(onRefresh).toHaveBeenCalledWith(updated));
    await waitFor(() =>
      expect(screen.queryByText(/^确认进入.*？$/)).toBeNull(),
    );
  } finally {
    finishRefresh?.();
  }
});

test('a pending stage submission cannot be cancelled and still refreshes on success', async () => {
  const updated: OpportunityRow = { ...opportunity, stage: 'negotiation' };
  let finishSubmit: ((row: OpportunityRow) => void) | undefined;
  jest.mocked(advanceOpportunityStage).mockImplementationOnce(
    () =>
      new Promise<OpportunityRow>((resolve) => {
        finishSubmit = resolve;
      }),
  );
  const onRefresh = jest.fn();
  render(
    React.createElement(OpportunityDetailModal, {
      opportunity: { ...opportunity, stage: 'quotation' },
      open: true,
      onClose: jest.fn(),
      onRefresh,
    }),
  );
  fireEvent.click(screen.getByRole('button', { name: /谈\s*判/ }));
  fireEvent.click(await screen.findByRole('button', { name: /^确\s*认$/ }));
  try {
    const cancel = screen.getByRole('button', {
      name: /取\s*消/,
    }) as HTMLButtonElement;
    await waitFor(() => expect(cancel.disabled).toBe(true));
    fireEvent.click(cancel);
    expect(onRefresh).not.toHaveBeenCalled();
    await act(async () => finishSubmit?.(updated));
    await waitFor(() => expect(onRefresh).toHaveBeenCalledWith(updated));
    await waitFor(() =>
      expect(screen.queryByText(/^确认进入.*？$/)).toBeNull(),
    );
  } finally {
    await act(async () => finishSubmit?.(updated));
  }
});
