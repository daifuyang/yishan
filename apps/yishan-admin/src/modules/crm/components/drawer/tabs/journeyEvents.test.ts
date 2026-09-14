import { buildCustomerSystemEvents } from './journeyEvents';

it('builds customer-scoped system journey events for opportunity, quotation, contract, and payment records', () => {
  const items = buildCustomerSystemEvents({
    opportunities: [{ id: 1, name: '升级项目', customerId: 7, stageCode: 'proposal', stageEnteredAt: '2026-09-10T09:00:00Z', expectedAmountCents: 10000, expectedCloseDate: null, ownerUserName: null }],
    quotations: [{ id: 2, quotationNo: 'QT-001', customerId: 7, status: 'sent', totalCents: 10000, validUntil: null, sentAt: '2026-09-11T09:00:00Z', acceptedAt: null, closedAt: null }],
    contracts: [{ id: 3, contractNo: 'CT-001', name: '服务合同', customerId: 7, opportunityId: 1, quotationId: 2, amountCents: 10000, status: 'performing', signedAt: '2026-09-12T09:00:00Z', effectiveAt: null, expiresAt: null, description: null }],
    payments: [{ id: 4, contractId: 3, customerId: 7, amountCents: 5000, paidAt: '2026-09-13T09:00:00Z', methodCode: 'bank_transfer', remark: null }],
  });

  expect(items.map((item) => item.content)).toEqual([
    '收到回款 ￥50.00',
    '合同「服务合同」进入履约中',
    '报价单 QT-001 已发送',
    '商机「升级项目」进入方案报价',
  ]);
  expect(items.every((item) => item.type === 'system_event')).toBe(true);
});
