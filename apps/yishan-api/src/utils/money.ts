/**
 * 金额工具（Money）—— 全局唯一的事实来源。
 *
 * 设计原则：
 *   - 内部一律以「分」整数（cents）存储与计算，避免 JS number 浮点误差。
 *   - 与 DB 交互：`amount_cents` 列使用 `bigint({ mode: 'number' })`，
 *     drizzle/mysql2 在 mysql 端会把 BIGINT 序列化成 JS number；
 *     **业务侧禁止直接做 ±×/**，必须走本工具。
 *   - 与前端交互：JSON 用 number（整数 cents）传输；前端按业务需要决定是否再 ×100 / ÷100。
 *   - 累加用整数加法，最后只做一次 toYuan 格式化展示。
 *
 * 安全边界：
 *   - JS number 在 > Number.MAX_SAFE_INTEGER 后丢失精度；本工具以 `Number.isSafeInteger`
 *     作为闸口，超过时抛错（不让业务表悄悄写出错误金额）。
 *   - 任何 API 都不会静默四舍五入到不存在的精度：用户输入 y.yy 时，cents = round(y.yy × 100)。
 *
 * 调用约定：
 *   - 入参是 number 时，必须明确是「元」还是「分」，命名上区分。
 *   - 出参统一是 cents（integer）或 string（展示用 "¥1,234.56"）。
 *
 * 不是：
 *   - 不是 BigDecimal；不处理超过 9 × 10^15 的金额（业务上无此需求）。
 *   - 不是多币种；多币种走 sys_enum + 汇率字段另行建模。
 */

/** 以「分」为单位的整数。BIGINT 列也通过 number mode 表达。 */
export type Cents = number

const CENT_PER_YUAN = 100

function assertSafeInteger(n: number, hint: string): void {
  if (!Number.isFinite(n) || !Number.isSafeInteger(n)) {
    throw new RangeError(
      `Money.${hint}: value=${n} is not a safe integer (max ${Number.MAX_SAFE_INTEGER}).`
    )
  }
}

/**
 * 把「元」number 转成「分」cents。
 *
 *   Money.yuan(12.34)         → 1234
 *   Money.yuan(12.345)        → 1235  (HALF_UP)
 *   Money.yuan(0.005)         → 1     (HALF_UP)
 *   Money.yuan(-12.34)        → -1234
 *
 * 注意：JS 的 0.1 + 0.2 !== 0.3 是浮点问题。这里把 yuan * 100 后用
 * Math.round，相当于把误差"消除"为最近整数 —— 在分单位粒度上这是正确的。
 */
export function yuanToCents(yuan: number): Cents {
  if (!Number.isFinite(yuan)) {
    throw new RangeError(`Money.yuanToCents: input is not finite: ${yuan}`)
  }
  const cents = Math.round(yuan * CENT_PER_YUAN)
  assertSafeInteger(cents, 'yuanToCents')
  return cents
}

/**
 * 把 cents 转回「元」number。
 * 转换是精确的（cents 是整数，÷100 不引入浮点尾数）。
 */
export function centsToYuan(cents: Cents): number {
  assertSafeInteger(cents, 'centsToYuan')
  return cents / CENT_PER_YUAN
}

/**
 * 解析「元」字符串。允许的输入：
 *   - "12", "12.3", "12.34", "12.345"
 *   - 前后空白自动 trim；空字符串 / null / undefined → null
 *   - 非数字字符（非 . - 数字）一律抛错
 *
 * 返回 cents；不会返回 0 来"代替"非法输入。
 */
export function parseYuanString(input: string | null | undefined): Cents | null {
  if (input == null) return null
  const trimmed = String(input).trim()
  if (trimmed === '') return null
  // 强格式：可选负号 + 数字 + 可选 . 与最多 4 位小数
  // 多于 4 位小数直接拒绝 —— DB 列只到 2 位小数，4 位内是给中间计算留余地
  if (!/^-?\d+(\.\d{1,4})?$/.test(trimmed)) {
    throw new RangeError(`Money.parseYuanString: invalid input "${input}"`)
  }
  return yuanToCents(Number(trimmed))
}

/**
 * 求和；空数组返回 0。所有元素必须是已 safe-integer 的 cents。
 *
 * 用 reduce 而非 += 数组：避免 V8 在循环内反复展开迭代器的临时变量。
 */
export function sumCents(values: readonly Cents[]): Cents {
  let total = 0
  for (const v of values) {
    assertSafeInteger(v, 'sumCents')
    total += v
  }
  assertSafeInteger(total, 'sumCents')
  return total
}

/**
 * 格式化 cents 为「¥1,234.56」展示串。
 *
 * - `locale='zh-CN'` → `¥1,234.56`
 * - `locale='en-US'` → `¥1,234.56`（货币符号保留 CNY；金额格式随 locale）
 * - locale=null 时回退到 zh-CN
 */
export function formatCents(
  cents: Cents,
  options: { locale?: string; withSymbol?: boolean; signed?: boolean } = {},
): string {
  assertSafeInteger(cents, 'formatCents')
  const { locale = 'zh-CN', withSymbol = true, signed = false } = options
  const yuan = cents / CENT_PER_YUAN
  const formatter = new Intl.NumberFormat(locale, {
    style: withSymbol ? 'currency' : 'decimal',
    currency: 'CNY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: signed ? 'auto' : 'never',
  })
  return formatter.format(yuan)
}

/**
 * 计算单行金额（报价单 / 商机 item）：
 *
 *   line = round(qty × unitPrice × (1 − discount) × (1 + taxRate))
 *
 * - qty: 数量 cents（×10000 倍精度，例如 12.3456 件 → 123456）
 * - unitPriceCents: 单价 cents
 * - discountBp: 折扣基点（万分比；1000 = 10% off）
 * - taxRateBp: 税率基点（万分比；1300 = 13%）
 *
 * 表达精度选 cents 整数，乘除后 round 到整数；累加误差在 1 分以内可控。
 */
export function computeLineAmountCents(args: {
  qty: number
  unitPriceCents: Cents
  discountBp: number
  taxRateBp: number
}): Cents {
  const { qty, unitPriceCents, discountBp, taxRateBp } = args
  assertSafeInteger(unitPriceCents, 'computeLineAmountCents.unitPriceCents')
  if (!Number.isFinite(qty)) {
    throw new RangeError(`Money.computeLineAmountCents: qty is not finite: ${qty}`)
  }
  // 折扣/税率钳位到合理范围
  if (discountBp < 0 || discountBp > 10000) {
    throw new RangeError(`Money.computeLineAmountCents: discountBp out of range ${discountBp}`)
  }
  if (taxRateBp < 0 || taxRateBp > 10000) {
    throw new RangeError(`Money.computeLineAmountCents: taxRateBp out of range ${taxRateBp}`)
  }
  const qtyFactor = qty / 10000 // qty 用 ×10000 表达的精度
  const lineBeforeTax = unitPriceCents * qtyFactor * (10000 - discountBp) / 10000
  const line = lineBeforeTax * (10000 + taxRateBp) / 10000
  const cents = Math.round(line)
  assertSafeInteger(cents, 'computeLineAmountCents')
  return cents
}

/**
 * 用 namespace 暴露，比直接导出多个独立函数更便于在 service 内一次性 import。
 */
export const Money = {
  yuanToCents,
  centsToYuan,
  parseYuanString,
  sumCents,
  formatCents,
  computeLineAmountCents,
}
