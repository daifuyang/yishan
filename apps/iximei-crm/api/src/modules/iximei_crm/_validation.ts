/**
 * CRM 客户/派单/医院表单的共享校验 helper。
 *
 * 重要：与 apps/yishan-admin/src/utils/validators.ts 的正则字面量保持一致。
 * 修改其中一处时请同步另一处；如需进一步共享请抽到 packages/shared。
 *
 * 异常 / 数据库 errno 翻译请使用 `@/modules/iximei_crm/utils/db-error`
 * 里的 withDbErrorMapping / translateDbError；本文件只放 CRM 业务校验。
 */
import { BusinessError } from '@yishan/core-api/errors'
import { ValidationErrorCode } from '@yishan/core-api/business-codes/validation'
import { UserErrorCode } from '@yishan/core-api/business-codes/user'
import { asDate } from './services/_shared.js'

// 重新从 core 导出 errno 翻译，保留旧 import 路径兼容。
export {
  ER_DUP_ENTRY, ER_DATA_TOO_LONG, ER_TRUNCATED_WRONG_VALUE,
  translateDbError, withDbErrorMapping, isDuplicateNumberIdError,
} from '@/modules/iximei_crm/utils/db-error'

/** 大陆手机号：以 1 开头，第二位 3-9，共 11 位 */
export const PHONE_RE = /^1[3-9]\d{9}$/

/** QQ：5–15 位数字，首位非 0 */
export const QQ_RE = /^[1-9]\d{4,14}$/

/** 微信：6–50 位字母/数字/下划线/减号；以字母开头 */
export const WECHAT_RE = /^[a-zA-Z][a-zA-Z0-9_-]{5,49}$/

/** 把空字符串（含纯空白）规整为 null，其它字符串 trim。 */
export function trimOrNull(v: unknown): string | null {
  if (v === undefined || v === null) return null
  if (typeof v !== 'string') return v as any
  const trimmed = v.trim()
  return trimmed.length === 0 ? null : trimmed
}

/** 把空字符串（含纯空白）规整为 undefined；不抛。 */
export function trimOrUndefined(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined
  if (typeof v !== 'string') return undefined
  const trimmed = v.trim()
  return trimmed.length === 0 ? undefined : trimmed
}

interface LengthRule {
  field: string
  min?: number
  max?: number
}

/** 必填字符串：trim 后必须满足 min/max；否则抛 PARAMETER_LENGTH_ERROR。 */
export function requireString(value: unknown, { field, min = 1, max }: LengthRule): string {
  const raw = typeof value === 'string' ? value : value == null ? '' : String(value)
  const trimmed = raw.trim()
  if (trimmed.length < min) {
    throw new BusinessError(ValidationErrorCode.PARAMETER_LENGTH_ERROR, `${field} 至少 ${min} 个字符`)
  }
  if (max !== undefined && trimmed.length > max) {
    throw new BusinessError(ValidationErrorCode.PARAMETER_LENGTH_ERROR, `${field} 最多 ${max} 个字符`)
  }
  return trimmed
}

interface OptionalStringRule extends LengthRule {
  pattern?: RegExp
  patternMessage?: string
  formatCode?: number
}

/**
 * 可选字符串：
 *  - 空 → null；
 *  - 非空 trim 后校验长度，超出 → PARAMETER_LENGTH_ERROR；
 *  - 给出 pattern 时不匹配 → PARAMETER_FORMAT_ERROR（或 formatCode 指定码）。
 */
export function optionalString(
  value: unknown,
  { field, max, pattern, patternMessage, formatCode }: OptionalStringRule,
): string | null {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') {
    throw new BusinessError(ValidationErrorCode.PARAMETER_FORMAT_ERROR, `${field} 必须是字符串`)
  }
  const trimmed = value.trim()
  if (trimmed.length === 0) return null
  if (max !== undefined && trimmed.length > max) {
    throw new BusinessError(ValidationErrorCode.PARAMETER_LENGTH_ERROR, `${field} 最多 ${max} 个字符`)
  }
  if (pattern && !pattern.test(trimmed)) {
    throw new BusinessError(
      formatCode ?? ValidationErrorCode.PARAMETER_FORMAT_ERROR,
      patternMessage ?? `${field} 格式不正确`,
    )
  }
  return trimmed
}

/** 必填手机号：trim 后必须匹配 PHONE_RE。 */
export function requirePhone(value: unknown, field = '手机号'): string {
  const trimmed = requireString(value, { field, min: 1, max: 20 })
  if (!PHONE_RE.test(trimmed)) {
    throw new BusinessError(UserErrorCode.PHONE_FORMAT_ERROR, `${field} 格式不正确`)
  }
  return trimmed
}

/** 可选手机号：提供时必须合法。 */
export function optionalPhone(value: unknown, field = '手机号'): string | null {
  return optionalString(value, {
    field,
    max: 20,
    pattern: PHONE_RE,
    patternMessage: `${field} 格式不正确`,
    formatCode: UserErrorCode.PHONE_FORMAT_ERROR,
  })
}

/** 可选 QQ：5–15 位数字，首位非 0。 */
export function optionalQq(value: unknown, field = 'QQ 号'): string | null {
  return optionalString(value, {
    field,
    max: 20,
    pattern: QQ_RE,
    patternMessage: `${field} 格式不正确`,
  })
}

/** 可选微信：6–50 位字母/数字/_/-，以字母开头。 */
export function optionalWechat(value: unknown, field = '微信号'): string | null {
  return optionalString(value, {
    field,
    max: 50,
    pattern: WECHAT_RE,
    patternMessage: `${field} 必须 6–50 位字母/数字/下划线/减号，且以字母开头`,
  })
}

/** 日期解析：trim 失败或 Date 非法 → 抛 PARAMETER_FORMAT_ERROR。返回 `YYYY-MM-DD` 字符串（保留 asDate 的本地时区语义）。 */
export function parseDateOrThrow(value: unknown, field = '日期'): string | undefined {
  if (value === undefined || value === null) return undefined
  const d = asDate(value)
  if (!d) {
    throw new BusinessError(ValidationErrorCode.PARAMETER_FORMAT_ERROR, `${field} 格式不正确`)
  }
  // MySQL DATE 列只接受 YYYY-MM-DD；dayjs / Date 在不同 Node 版本下 toISOString() 会带 Z 与毫秒，
  // 这里使用本地时区的日期片段，避免跨时区把同一天写成另一天。
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
