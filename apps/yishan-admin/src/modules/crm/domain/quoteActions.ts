import type { QuotationRow } from '@/services/crm';

interface QuoteActionContext {
  status: QuotationRow['status'];
  hasShare?: boolean;
  share?: { status: 'active' | 'revoked' } | null;
  contractId?: number | null;
}

export function getQuoteActions(
  quote: QuoteActionContext,
  can: (permission: string) => boolean,
) {
  const published = quote.hasShare === true || Boolean(quote.share);
  const unpublished = quote.hasShare === false || quote.share === null;
  const editable = quote.status === 'draft' && !published && unpublished;
  return {
    canCreateVersion:
      (quote.status === 'sent' ||
        quote.status === 'accepted' ||
        quote.status === 'voided') &&
      can('crm:quotation:create') &&
      can('crm:quotation:update'),
    canEdit: editable && can('crm:quotation:update'),
    canShare:
      (quote.status === 'draft' || quote.status === 'sent' || quote.status === 'accepted') &&
      can('crm:quotation:send'),
    canVoid:
      (quote.status === 'sent' || (quote.status === 'draft' && published)) &&
      can('crm:quotation:void'),
    canDelete: editable && can('crm:quotation:delete'),
    canConfirm: quote.status === 'sent' && can('crm:quotation:accept'),
    canRevokeConfirmation: quote.status === 'accepted' && quote.contractId === null && can('crm:quotation:accept'),
    canCreateContract: quote.status === 'accepted' && can('crm:contract:create'),
  };
}
