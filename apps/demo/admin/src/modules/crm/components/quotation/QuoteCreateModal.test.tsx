import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import dayjs from 'dayjs';
import React from 'react';
import {
  createQuotation,
  getQuotation,
  updateQuotation,
  listContactsByCustomer,
  listOpportunities,
} from '@/services/crm';
import QuoteCreateModal from './QuoteCreateModal';

type OpportunityRow = import('@/services/crm').OpportunityRow;

jest.mock('@/utils/permission', () => ({ usePermission: () => () => true }));
jest.mock('@/services/crm', () => ({
  createQuotation: jest.fn(),
  getQuotation: jest.fn(),
  updateQuotation: jest.fn(),
  listContactsByCustomer: jest.fn(),
  listOpportunities: jest.fn(),
  listAllPages: async (
    load: (page: number, pageSize: number) => Promise<{ data: unknown[] }>,
  ) => (await load(1, 100)).data,
}));
jest.mock('./QuoteDetailModal', () => ({
  __esModule: true,
  default: () => null,
  QUOTATION_CHANGED_EVENT: 'quotation-changed',
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

test('edit reuses the quote form and updates the existing draft without creating a new quote', async () => {
  jest
    .mocked(listOpportunities)
    .mockResolvedValue({
      data: [{ ...opportunity, stage: 'negotiation' }],
      total: 1,
    });
  jest.mocked(getQuotation).mockResolvedValue({
    id: 8,
    status: 'draft',
    share: null,
    customerId: 23,
    opportunityId: 1,
    contactId: 15,
    name: '现有报价',
    quoteDate: '2026-10-07',
    validUntil: '2026-10-14',
    discountAmountCents: 0,
    items: [
      {
        productNameSnapshot: '现有项目',
        quantityCents: 10000,
        unitPriceCents: 100000,
      },
    ],
  } as import('@/services/crm').QuotationResp);
  jest
    .mocked(updateQuotation)
    .mockResolvedValue({ id: 8 } as import('@/services/crm').QuotationResp);
  render(
    React.createElement(QuoteCreateModal, {
      quotationId: 8,
      customerId: 23,
      renderTrigger: (open) =>
        React.createElement(
          'button',
          { type: 'button', onClick: open },
          '编辑',
        ),
    }),
  );
  fireEvent.click(screen.getByText('编辑'));
  await screen.findByText('编辑报价');
  await waitFor(() =>
    expect((screen.getByLabelText('报价名称') as HTMLInputElement).value).toBe(
      '现有报价',
    ),
  );
  expect(screen.getByLabelText('商机').closest('.ant-select')?.textContent).toContain(
    opportunity.name,
  );
  fireEvent.change(screen.getByLabelText('报价名称'), {
    target: { value: '修改报价名称' },
  });
  fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }));
  await waitFor(() =>
    expect(updateQuotation).toHaveBeenCalledWith(
      8,
      expect.objectContaining({ name: '修改报价名称' }),
    ),
  );
  expect(createQuotation).not.toHaveBeenCalled();
});
afterAll(() => {
  window.getComputedStyle = originalStyle;
});
const opportunity: OpportunityRow = {
  id: 1,
  opportunityNo: 'OPP-202610-0001',
  customerId: 23,
  customerName: '上海禾味餐饮管理有限公司',
  name: '禾味餐饮 CRM 数字化项目',
  primaryContactId: 15,
  ownerId: 7,
  ownerName: '愚公',
  stage: 'solution',
  products: [],
  amountCents: 6000000,
  expectedCloseDate: '2026-10-31',
};
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(listContactsByCustomer).mockResolvedValue([
    {
      id: 15,
      customerId: 23,
      name: '张明远',
      isPrimary: 1,
    } as import('@/services/crm').ContactRow,
  ]);
});
async function openForm() {
  render(
    React.createElement(QuoteCreateModal, {
      opportunity,
      renderTrigger: (open) =>
        React.createElement(
          'button',
          { type: 'button', onClick: open },
          '新建',
        ),
    }),
  );
  fireEvent.click(screen.getByText('新建'));
  await screen.findByText('张明远');
}
test('context is derived, system fields are omitted and quantity removes trailing zeros', async () => {
  await openForm();
  expect(screen.queryByText('状态')).toBeNull();
  expect(screen.queryByText('负责人')).toBeNull();
  expect(
    (screen.getByRole('textbox', { name: '报价名称' }) as HTMLInputElement)
      .value,
  ).toBe(`${opportunity.name}报价`);
  expect(
    (screen.getByRole('spinbutton', { name: '数量1' }) as HTMLInputElement)
      .value,
  ).toBe('1');
  expect(screen.queryByLabelText('对外优惠说明')).toBeNull();
  expect(screen.queryByLabelText('内部优惠原因')).toBeNull();
});
test('customer entry scopes opportunity lookup and preserves manually edited names', async () => {
  jest.mocked(listOpportunities).mockResolvedValue({
    data: [opportunity, { ...opportunity, id: 2, name: '二期项目' }],
    total: 2,
  });
  render(
    React.createElement(QuoteCreateModal, {
      customerId: 23,
      customerName: opportunity.customerName ?? '',
      renderTrigger: (open) =>
        React.createElement(
          'button',
          { type: 'button', onClick: open },
          '新建',
        ),
    }),
  );
  fireEvent.click(screen.getByText('新建'));
  await screen.findByText('张明远');
  expect(listOpportunities).toHaveBeenCalledWith({
    customerId: 23,
    page: 1,
    pageSize: 100,
  });
  const select = screen.getByLabelText('商机');
  fireEvent.mouseDown(select);
  fireEvent.click(await screen.findByText(opportunity.name));
  const name = screen.getByLabelText('报价名称') as HTMLInputElement;
  expect(name.value).toBe(`${opportunity.name}第一版报价`);
  fireEvent.mouseDown(select);
  fireEvent.click(await screen.findByText('二期项目'));
  expect(name.value).toBe('二期项目第一版报价');
  fireEvent.change(name, { target: { value: '定制商务报价' } });
  fireEvent.mouseDown(select);
  fireEvent.click(await screen.findByText(opportunity.name));
  expect(name.value).toBe('定制商务报价');
});
test('validity follows date plus seven days until manually changed', async () => {
  await openForm();
  const date = screen.getByLabelText('报价日期');
  const validity = screen.getByLabelText('有效期至');
  expect((validity as HTMLInputElement).value).toBe(
    dayjs().add(7, 'day').format('YYYY-MM-DD'),
  );
  fireEvent.focus(date);
  fireEvent.change(date, { target: { value: '2026-11-01' } });
  fireEvent.keyDown(date, { key: 'Enter', code: 'Enter' });
  fireEvent.blur(date);
  await waitFor(() =>
    expect((validity as HTMLInputElement).value).toBe('2026-11-08'),
  );
  fireEvent.focus(validity);
  fireEvent.change(validity, { target: { value: '2026-11-20' } });
  fireEvent.keyDown(validity, { key: 'Enter', code: 'Enter' });
  fireEvent.blur(validity);
  fireEvent.focus(date);
  fireEvent.change(date, { target: { value: '2026-11-02' } });
  fireEvent.keyDown(date, { key: 'Enter', code: 'Enter' });
  fireEvent.blur(date);
  await waitFor(() =>
    expect((validity as HTMLInputElement).value).toBe('2026-11-20'),
  );
});
test('positive discount reveals both explanations and saves distinct snapshots', async () => {
  await openForm();
  fireEvent.change(screen.getByLabelText('项目名称1'), {
    target: { value: '标准 CRM 基础方案' },
  });
  fireEvent.change(screen.getByLabelText('单价1'), {
    target: { value: '70000' },
  });
  fireEvent.change(screen.getByLabelText('优惠金额'), {
    target: { value: '4000' },
  });
  fireEvent.change(await screen.findByLabelText('对外优惠说明'), {
    target: { value: '首期合作优惠' },
  });
  fireEvent.change(screen.getByLabelText('内部优惠原因'), {
    target: { value: '竞争性报价，用于推进首次合作' },
  });
  expect(screen.getByText('仅内部可见，不会展示给客户。')).toBeTruthy();
  jest
    .mocked(createQuotation)
    .mockResolvedValue({ id: 1 } as import('@/services/crm').QuotationResp);
  fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }));
  await waitFor(() =>
    expect(createQuotation).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 23,
        opportunityId: 1,
        contactId: 15,
        discountAmountCents: 400000,
        publicDiscountDescription: '首期合作优惠',
        internalDiscountReason: '竞争性报价，用于推进首次合作',
      }),
    ),
  );
});
