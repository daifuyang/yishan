/**
 * date-field — HTTP 契约里的**日期字段**出参归一。
 *
 * ## 为什么前端也要折一次
 *
 * 契约 `createUserReq.birthDate` 是 `format: "date"`，只收 `YYYY-MM-DD`，ajv 在
 * `preValidation` 就会拒掉 ISO（`1996-10-02T00:00:00.000Z` → 400，业务码 21001）。
 * 但日期的**形状由生产者决定**：AI 预填、浏览器 DatePicker 的某些序列化路径给出
 * 的是 ISO。后端有 `draft-field-format.ts` 在写入/比较入口折，但**它永远接不到
 * 被 ajv 先拒掉的请求体** —— 所以出参这一侧必须自己保证是规范形式。
 *
 * 规则与后端 `canonicalDateOnly` 一致（同一份语义，两个包各持一份实现：
 * 前端不能 import 后端包）：
 * - 取**字面日期部分**，不做时区换算 —— 日期字段没有时刻语义，换时区换掉用户
 *   填的日期比形状不一致更糟；
 * - 日历上不存在（`1996-02-31`）或形状不认识的值**原样透传**，让后端 ajv 按
 *   原规则报错，不在这里静默吞掉。
 */

/** `YYYY-MM-DD`。 */
const CANONICAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
/** ISO 日期时间的最小尾巴：`T00:00` 或空格 + `00:00`。 */
const DATE_TIME_TAIL_PATTERN = /^[T ]\d{2}:\d{2}/;

/**
 * 把任意日期写法折成 `YYYY-MM-DD`；**无法识别时原样返回入参**。
 *
 * 与后端的区别：后端返回 `undefined` 表示「不归一、保留原值交给校验」，
 * 这里直接返回原值，效果等价，但调用点少一层判空。
 */
export function toContractDate(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  const head = trimmed.slice(0, 10);
  if (!CANONICAL_DATE_PATTERN.test(head)) return value;
  const tail = trimmed.slice(10);
  if (tail && !DATE_TIME_TAIL_PATTERN.test(tail)) return value;
  const [year, month, day] = head.split('-').map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return value;
  }
  return head;
}
