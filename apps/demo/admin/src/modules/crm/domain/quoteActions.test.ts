import { getQuoteActions } from './quoteActions';
import { opportunityStageActions } from './statuses';

test('unshared drafts offer edit, share and delete', () => {
  expect(
    getQuoteActions({ status: 'draft', hasShare: false }, () => true),
  ).toMatchObject({
    canEdit: true,
    canShare: true,
    canVoid: false,
    canDelete: true,
    canCreateVersion: false,
  });
});
test.each(['active', 'revoked'] as const)(
  'a draft with a %s share remains immutable',
  (status) => {
    expect(
      getQuoteActions({ status: 'draft', share: { status } }, () => true),
    ).toMatchObject({
      canEdit: false,
      canShare: true,
      canVoid: true,
      canDelete: false,
    });
  },
);
test('sent quotations offer share and void, never edit or delete', () => {
  expect(getQuoteActions({ status: 'sent' }, () => true)).toMatchObject({
    canEdit: false,
    canShare: true,
    canVoid: true,
    canDelete: false,
    canCreateVersion: true,
  });
});
test('voided and closed quotations do not offer edit, share, void or delete', () => {
  for (const status of [
    'voided',
    'rejected',
    'superseded',
  ] as const)
    expect(getQuoteActions({ status }, () => true)).toMatchObject({
      canEdit: false,
      canShare: false,
      canVoid: false,
      canDelete: false,
    });
});
test('permission denial removes all mutating actions', () => {
  expect(
    getQuoteActions({ status: 'draft', hasShare: false }, () => false),
  ).toMatchObject({
    canEdit: false,
    canShare: false,
    canVoid: false,
    canDelete: false,
    canCreateVersion: false,
  });
});

test('sent and voided quotations can create a new version; a draft must be sent first', () => {
  for (const status of ['sent', 'voided'] as const) {
    expect(getQuoteActions({ status }, () => true).canCreateVersion).toBe(true);
    expect(
      getQuoteActions(
        { status },
        (permission) => permission !== 'crm:quotation:create',
      ).canCreateVersion,
    ).toBe(false);
    expect(
      getQuoteActions(
        { status },
        (permission) => permission !== 'crm:quotation:update',
      ).canCreateVersion,
    ).toBe(false);
  }
  expect(
    getQuoteActions({ status: 'draft', hasShare: true }, () => true)
      .canCreateVersion,
  ).toBe(false);
});
test('unknown share history never grants edit or delete', () => {
  expect(getQuoteActions({ status: 'draft' }, () => true)).toMatchObject({
    canEdit: false,
    canDelete: false,
  });
});
test('opportunity actions use short verbs and leave negotiation without a progression action', () => {
  expect(opportunityStageActions.needs_confirmation?.label).toBe('方案');
  expect(opportunityStageActions.solution?.label).toBe('报价');
  expect(opportunityStageActions.quotation?.label).toBe('谈判');
  expect(opportunityStageActions.negotiation).toBeUndefined();
});

test('confirmed quotes offer version creation, contract form and conditional revocation', () => {
  expect(getQuoteActions({ status: 'accepted', contractId: null }, () => true)).toMatchObject({ canEdit: false, canShare: true, canConfirm: false, canCreateVersion: true, canCreateContract: true, canRevokeConfirmation: true });
  expect(getQuoteActions({ status: 'accepted', contractId: 31 }, () => true).canRevokeConfirmation).toBe(false);
  expect(getQuoteActions({ status: 'sent' }, () => true).canConfirm).toBe(true);
  expect(getQuoteActions({ status: 'sent' }, () => false).canConfirm).toBe(false);
});
