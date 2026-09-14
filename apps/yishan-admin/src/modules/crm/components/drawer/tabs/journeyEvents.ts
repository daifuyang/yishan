import type {
  ActivityRow,
  ContractRow,
  OpportunityRow,
  PaymentRow,
  QuotationRow,
} from '@/services/crm';
import {
  OPPORTUNITY_STAGES,
  QUOTATION_STATUSES,
  statusOf,
} from '@/modules/crm/domain/statuses';

const money = (cents: number) =>
  `￥${(cents / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;
const systemEvent = (
  id: number,
  content: string,
  occurredAt: string,
): ActivityRow => ({
  id,
  customerId: 0,
  contactId: null,
  type: 'system_event',
  content,
  occurredAt,
  nextFollowUpAt: null,
  operatorUserId: 0,
  operatorUserName: '系统',
  createdAt: occurredAt,
  updatedAt: occurredAt,
});

export function buildCustomerSystemEvents({
  opportunities,
  quotations,
  contracts,
  payments,
}: {
  opportunities: OpportunityRow[];
  quotations: QuotationRow[];
  contracts: ContractRow[];
  payments: PaymentRow[];
}): ActivityRow[] {
  return [
    ...opportunities.flatMap((item) =>
      item.stageEnteredAt
        ? [
            systemEvent(
              -1000000 - item.id,
              `商机「${item.name}」进入${statusOf(item.stageCode, OPPORTUNITY_STAGES).label}`,
              item.stageEnteredAt,
            ),
          ]
        : [],
    ),
    ...quotations.flatMap((item) =>
      [
        item.sentAt
          ? systemEvent(
              -2000000 - item.id * 10,
              `报价单 ${item.quotationNo} ${statusOf('sent', QUOTATION_STATUSES).label}`,
              item.sentAt,
            )
          : null,
        item.acceptedAt
          ? systemEvent(
              -2000001 - item.id * 10,
              `报价单 ${item.quotationNo} ${statusOf('accepted', QUOTATION_STATUSES).label}`,
              item.acceptedAt,
            )
          : null,
        item.closedAt
          ? systemEvent(
              -2000002 - item.id * 10,
              `报价单 ${item.quotationNo} ${statusOf(item.status, QUOTATION_STATUSES).label}`,
              item.closedAt,
            )
          : null,
      ].filter((event): event is ActivityRow => event !== null),
    ),
    ...contracts.map((item) =>
      systemEvent(
        -3000000 - item.id,
        `合同「${item.name}」已创建`,
        item.createdAt,
      ),
    ),
    ...payments.map((item) =>
      systemEvent(
        -4000000 - item.id,
        `收到回款 ${money(item.amountCents)}`,
        item.paidAt,
      ),
    ),
  ].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}
