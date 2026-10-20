/**
 * draft-field-format.ts — 草稿字段的**规范形式**（canonical form）与类型派生。
 *
 * ## 为什么要有这一层
 *
 * 一个业务事实只能有**一种形状**。「1996-10-02」与「1996-10-02T00:00:00.000Z」
 * 是同一个生日的两种写法，但系统里原本有两套互不知情的规则分别对待它们：
 *
 * - HTTP 契约 `createUserReq.birthDate` 是 `format: "date"`，只收 `YYYY-MM-DD`；
 * - 草稿一致性比较（`mergeDraftFields`）是**字符串全等**。
 *
 * 于是形成一个**没有解**的夹缝：草稿里存 ISO → 提交 `YYYY-MM-DD` 被判「与服务端
 * 草稿不一致」；草稿里存 `YYYY-MM-DD` → 提交 ISO 被 ajv 以 format 拒掉。
 * 而草稿的写入方是**模型**：模型给出 ISO 时间戳是完全正常的行为，原生表单回填
 * 也会把 DatePicker 序列化成 ISO。这个夹缝在生产上表现为「AI 建号永远失败」。
 *
 * ## 规则
 *
 * 1. **唯一权威形式**：日期字段在系统内部一律是 `YYYY-MM-DD`。
 *    数据库列是 `date`，HTTP 契约是 `format: "date"`，前端 pro-field 序列化成
 *    `YYYY-MM-DD` —— 三者本来就指向同一个形式，缺的只是把它写下来并执行。
 * 2. **在边界归一**：形状由**生产者**决定（模型、原生表单回填、外部调用方），
 *    因此归一发生在写入口与比较入口，而不是散落在下游各处做「兼容两种写法」。
 * 3. **内部只传规范形式**：归一之后，下游拿到的永远是 `YYYY-MM-DD`，
 *    不需要再判断「这是 ISO 还是日期」。
 * 4. **归一不是拒绝**：值本身合法、只是写法不同，就折成规范形式；
 *    真正无法识别的值保持原样，交给既有的 `validationErrors` 通道报错
 *    （草稿必须能存下「刚打了一半」的值，这是它的既有契约）。
 */

/** 日期字段的唯一权威形式。 */
export const CANONICAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** ISO 日期时间的最小形状：`1996-10-02T00:00:00.000Z`。 */
const DATE_TIME_TAIL_PATTERN = /^[T ]\d{2}:\d{2}/

/**
 * 把任意日期写法折成 `YYYY-MM-DD`；无法识别返回 `undefined`。
 *
 * 接受的输入：
 * - `1996-10-02`（已是规范形式）
 * - `1996-10-02T00:00:00.000Z` / `1996-10-02 00:00:00`（**取字面日期部分**）
 * - `1996-10-02T23:59:59-05:00`
 *
 * 取**字面日期部分**而不是「转成 UTC 再取日期」：日期字段没有时刻语义，
 * 用户填的是「哪一天」。同一个 `1996-10-02T00:00:00.000Z` 在任何时区都应当
 * 折成 `1996-10-02` —— 换时区就换掉用户填的日期，是比形状不一致更糟的 bug。
 *
 * 拒绝的输入：`1996-13-01`、`1996-02-31`（日历上不存在）、
 * `1996-10-02abc`（日期后面跟的不是时间）、非字符串。
 */
export function canonicalDateOnly(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const head = trimmed.slice(0, 10)
  if (!CANONICAL_DATE_PATTERN.test(head)) return undefined
  const tail = trimmed.slice(10)
  if (tail && !DATE_TIME_TAIL_PATTERN.test(tail)) return undefined
  const [year, month, day] = head.split('-').map(Number)
  // 日历有效性：1996-02-31 不是一个日期。
  const probe = new Date(Date.UTC(year, month - 1, day))
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    return undefined
  }
  return head
}

/**
 * 把规范日期折成**本地日历日**的 `Date`。
 *
 * `new Date('1996-10-02')` 走的是 UTC 午夜，在 UTC-5 的机器上落到
 * `1996-10-01 19:00`，写进 `date` 列就变成 10-01 —— 差一天。
 * 按本地年月日构造 `Date` 可以让「用户填的哪天就是存进去的哪天」，
 * 与服务器时区无关。
 */
export function canonicalDateToLocalDate(canonical: string): Date {
  const [year, month, day] = canonical.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/**
 * 从 schema 的 properties 里派生「日期字段」的键集合。
 *
 * **派生而不是另抄一份**：字段类型的事实住在表单契约（schema）里，
 * 这里只把它读出来。加一个日期字段时不需要改第二处清单 ——
 * 这类「两份清单」的分叉历史上出过事故（草稿字段白名单就曾经有三份拷贝）。
 *
 * `format` 可能挂在联合类型的成员上（`birthDate` 是
 * `Union([String({ format: 'date' }), Literal('')])`），因此要向下看一层。
 */
export function dateFormatFieldKeys(properties: Record<string, unknown>): ReadonlySet<string> {
  const keys = new Set<string>()
  for (const [key, property] of Object.entries(properties)) {
    if (formatOf(property) === 'date') keys.add(key)
  }
  return keys
}

/** 取一个 schema 片段的 `format`（联合类型取第一个带 format 的成员）。 */
export function formatOf(property: unknown): string | undefined {
  if (!property || typeof property !== 'object') return undefined
  const schema = property as { format?: unknown; anyOf?: unknown[]; oneOf?: unknown[] }
  if (typeof schema.format === 'string') return schema.format
  for (const members of [schema.anyOf, schema.oneOf]) {
    if (!Array.isArray(members)) continue
    for (const member of members) {
      const format = formatOf(member)
      if (format) return format
    }
  }
  return undefined
}
