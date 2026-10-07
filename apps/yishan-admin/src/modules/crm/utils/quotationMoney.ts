export const formatQuoteMoney = (cents: number) =>
  `¥${(cents / 100).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`;

export const yuanToCents = (yuan: number) => Math.round(yuan * 100);

export function formatQuoteNumberInput(
  value: string | number | undefined,
  info: { userTyping: boolean; input: string },
) {
  if (info.userTyping) return info.input;
  if (value === undefined || value === '') return '';
  return Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 4 });
}

export function lineAmountCents(item: {
  quantity?: number;
  unitPriceYuan?: number;
  discountBp?: number;
  taxRateBp?: number;
}) {
  const quantity = BigInt(Math.round((item.quantity ?? 0) * 10000));
  const price = BigInt(yuanToCents(item.unitPriceYuan ?? 0));
  const discount = BigInt(10000 - (item.discountBp ?? 0));
  const tax = BigInt(10000 + (item.taxRateBp ?? 0));
  return Number(
    (quantity * price * discount * tax + 500000000000n) / 1000000000000n,
  );
}

export function quoteTotals(
  items: {
    quantity?: number;
    unitPriceYuan?: number;
    discountBp?: number;
    taxRateBp?: number;
  }[],
  discountYuan: number,
) {
  const subtotal = items.reduce((sum, item) => sum + lineAmountCents(item), 0);
  const discount = yuanToCents(discountYuan);
  return { subtotal, discount, total: subtotal - discount };
}
