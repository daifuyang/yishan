/**
 * draft-completion.ts — 草稿的「**待补全字段**」计算。
 *
 * 这是一份**纯函数**：输入是真实的表单契约（`AiDraftForm`，字段、约束、默认值、
 * 可写白名单都来自业务自己的 create schema）、草稿当前的值与已知校验错误，
 * 输出是「现在还需要用户处理哪些字段」。
 *
 * 规则全部来自契约，**不按字段名硬编码**：
 *
 * 1. 已填且合法的字段不再出现 —— 用户给过的信息不重复问。
 * 2. 未填的**必填与选填**字段都要出现 —— 「选填」不是「不用填」。
 * 3. `0` / `false` 是合法值，不算「没填」（`hasValue` 的口径与草稿服务一致）。
 * 4. 填了但不合法（`validationErrors` 命中）的字段要出现，且标记为「需要修正」。
 * 5. 契约里声明了默认值的字段按「已填」处理 —— 默认值跟随原生表单的逻辑。
 * 6. 契约里声明为隐藏的字段不出现。
 * 7. 敏感字段（密码）**照样出现**：它只是不能进草稿、不能进模型上下文，
 *    用户仍然要在受保护的表单控件里输入它。
 * 8. `draftWritable` 由**可写白名单**（`editableFields`）派生，不看字段名：
 *    密码、头像这类「只能随提交走一次」的值因此天然被排除在补丁之外。
 */
import type { AiDraftForm } from '@yishan/core-api/ai-capabilities/catalog'

/** 一个待补全字段。形状与前端 `AiCompletionField` 一一对应。 */
export interface DraftCompletionField {
  /** 字段名（业务契约里的名字）。 */
  name: string
  /** 面向用户的中文标签。 */
  label: string
  /** 是否必填。 */
  required: boolean
  /** 敏感字段：值不进草稿、不进模型上下文，只随提交走一次。 */
  sensitive: boolean
  /** 选择器标识（`deptTree` / `roleOptions` / `enum` / `date` / `email` / `password` / `text`）。 */
  selector: string
  /** 来自真实表单契约的约束子集。 */
  constraints: Record<string, unknown>
  /** 值能不能写进 AI 草稿。 */
  draftWritable: boolean
  /** 已填但不合法的字段：需要用户修正。 */
  invalid: boolean
}

/**
 * 「这个字段有值吗」的**唯一**判定。
 *
 * 与 `ActionDraftService` 里的同名判断保持一致：`undefined` / `null` / 空串算没有，
 * `0` 与 `false` 算有值。两处口径必须一致，否则草稿会一边说「已收集」、
 * 一边把字段列进待补全清单。
 */
export function hasDraftValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== ''
}

/**
 * 契约里可选的扩展位：`hidden` 字段不展示（条件隐藏的业务表单用得上）。
 *
 * 用可选读而不是改契约类型：表单契约是业务自己的形状，AI 侧只**消费**它，
 * 不替它决定字段的可见性规则。
 */
function isHidden(field: { name: string }): boolean {
  return (field as { hidden?: boolean }).hidden === true
}

/**
 * 算出「现在还需要用户处理哪些字段」。
 *
 * @param form 业务自己的表单契约（字段、约束、默认值、可写白名单）
 * @param values 草稿当前的值（服务端草稿是唯一事实来源）
 * @param validationErrors 服务端算出的已知错误（用于标出「需要修正」的字段）
 */
export function computeDraftCompletionFields(
  form: AiDraftForm,
  values: Record<string, unknown>,
  validationErrors: readonly { field: string }[] = [],
): DraftCompletionField[] {
  const invalidFields = new Set(validationErrors.map(error => error.field))
  const writable = new Set(form.editableFields)
  const defaults = form.defaults ?? {}
  const out: DraftCompletionField[] = []
  for (const field of form.fields) {
    if (isHidden(field)) continue
    const draftWritable = writable.has(field.name)
    const value = values?.[field.name]
    const filled = hasDraftValue(value) || hasDraftValue(defaults[field.name])
    const invalid = invalidFields.has(field.name)
    // 已经填好且没有已知错误：不再打扰用户。
    if (filled && !invalid) continue
    out.push({
      name: field.name,
      label: field.label,
      required: field.required,
      sensitive: field.sensitive,
      selector: field.selector,
      constraints: field.constraints ?? {},
      draftWritable,
      invalid,
    })
  }
  return out
}
