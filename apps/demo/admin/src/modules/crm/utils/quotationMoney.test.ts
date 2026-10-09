import {
  formatQuoteNumberInput,
  lineAmountCents,
  quoteTotals,
} from './quotationMoney';

test('editing legacy line discounts and taxes preserves the server calculation', () => {
  expect(
    lineAmountCents({
      quantity: 1,
      unitPriceYuan: 12.34,
      discountBp: 1000,
      taxRateBp: 1300,
    }),
  ).toBe(1255);
});

test('input numbers remove insignificant zeros and keep meaningful decimals', () => {
  const info = { userTyping: false, input: '' };
  expect(formatQuoteNumberInput('1.0000', info)).toBe('1');
  expect(formatQuoteNumberInput('1.5000', info)).toBe('1.5');
  expect(formatQuoteNumberInput('1.2500', info)).toBe('1.25');
  expect(formatQuoteNumberInput('36000.00', info)).toBe('36,000');
  expect(formatQuoteNumberInput(1, { userTyping: true, input: '1.' })).toBe(
    '1.',
  );
});

test('calculates sandbox totals in integer cents', () => {
  expect(
    quoteTotals(
      [36000, 12000, 18000, 4000].map((unitPriceYuan) => ({
        quantity: 1,
        unitPriceYuan,
      })),
      4000,
    ),
  ).toEqual({ subtotal: 7000000, discount: 400000, total: 6600000 });
});
test('rounds each fractional quantity line before summing', () => {
  expect(lineAmountCents({ quantity: 0.125, unitPriceYuan: 0.12 })).toBe(2);
});
