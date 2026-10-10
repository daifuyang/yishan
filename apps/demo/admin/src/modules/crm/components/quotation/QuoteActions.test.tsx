import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { getQuotation } from '@/services/crm';
import QuoteActions from './QuoteActions';

type QuotationResp = import('@/services/crm').QuotationResp;
type QuoteSeriesSummary = import('@/services/crm').QuoteSeriesSummary;

jest.mock('@/utils/permission', () => ({ usePermission: () => () => true }));
jest.mock('@/services/crm', () => ({ getQuotation: jest.fn() }));

globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const series: QuoteSeriesSummary = {
  seriesId: 'series-a',
  title: '项目报价',
  customerId: 23,
  currentQuoteId: 4,
  currentStatus: 'sent',
  hasActiveShare: true,
};
const activeShare: QuotationResp['share'] = {
  id: 10,
  status: 'active',
  url: '/q/customer-link',
  expiresAt: '2099-10-14T15:59:59Z',
  sentAt: null,
  firstViewedAt: null,
  lastViewedAt: null,
  viewCount: 0,
};
let copy: jest.Mock;
beforeEach(() => {
  jest.clearAllMocks();
  copy = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: copy },
  });
  jest
    .mocked(getQuotation)
    .mockResolvedValue({ share: activeShare } as QuotationResp);
});

test('detail opens the quote while share copies the existing customer URL directly', async () => {
  const detail = jest.fn();
  const generate = jest.fn();
  render(
    React.createElement(QuoteActions, {
      quote: series,
      onDetail: detail,
      onGenerate: generate,
      onChanged: jest.fn(),
    }),
  );
  fireEvent.click(screen.getByRole('button', { name: /详\s*情/ }));
  expect(detail).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: /分\s*享/ }));
  await waitFor(() =>
    expect(copy).toHaveBeenCalledWith('http://localhost:8000/q/customer-link'),
  );
  expect(getQuotation).toHaveBeenCalledWith(4);
  expect(detail).toHaveBeenCalledTimes(1);
  expect(generate).not.toHaveBeenCalled();
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('unshared draft offers generation instead of a misleading share action', () => {
  const generate = jest.fn();
  render(
    React.createElement(QuoteActions, {
      quote: { ...series, currentStatus: 'draft', hasActiveShare: false },
      onDetail: jest.fn(),
      onGenerate: generate,
      onChanged: jest.fn(),
    }),
  );
  expect(screen.queryByRole('button', { name: /分\s*享/ })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /生\s*成/ }));
  expect(generate).toHaveBeenCalledTimes(1);
});

test.each([
  { ...activeShare, status: 'revoked' as const },
  { ...activeShare, expiresAt: '2020-01-01T00:00:00Z' },
])('a stale list never copies an invalid share', async (share) => {
  jest.mocked(getQuotation).mockResolvedValue({ share } as QuotationResp);
  render(
    React.createElement(QuoteActions, {
      quote: series,
      onDetail: jest.fn(),
      onGenerate: jest.fn(),
      onChanged: jest.fn(),
    }),
  );
  fireEvent.click(screen.getByRole('button', { name: /分\s*享/ }));
  await screen.findByText('分享链接已失效，请在详情中重新生成');
  expect(copy).not.toHaveBeenCalled();
});

test('a published draft never offers another version in the list menu', async () => {
  render(
    React.createElement(QuoteActions, {
      quote: { ...series, currentStatus: 'draft' },
      onDetail: jest.fn(),
      onGenerate: jest.fn(),
      onChanged: jest.fn(),
    }),
  );
  fireEvent.click(screen.getByRole('button', { name: '更多报价操作' }));
  await screen.findByRole('menuitem', { name: '作废' });
  expect(screen.queryByRole('menuitem', { name: '新版本' })).toBeNull();
});
