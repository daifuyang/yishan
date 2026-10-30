/**
 * MySQL errno → 业务码翻译。
 *
 * 原本住在 core/plugins/external/db-error.ts —— 但它翻译的全是 crm 的语义
 * （`crm_customer` / `crm_member_customer` 的 `number_id` 唯一键、客户/会员编号文案），
 * 属于业务逻辑放错了层。换基座时一并下沉到业务模块内。
 *
 * 用法：
 *   return withDbErrorMapping(() => CustomersRepository.create(input))
 */
import { BusinessError } from '@yishan/core-api/errors'
import { ValidationErrorCode } from '@yishan/core-api/business-codes/validation'
import { ResourceErrorCode } from '@yishan/core-api/business-codes/resource'

/** MySQL 重复键 */
export const ER_DUP_ENTRY = 1062
/** 数据过长（超过列宽） */
export const ER_DATA_TOO_LONG = 1406
/** 字段值类型不匹配 */
export const ER_TRUNCATED_WRONG_VALUE = 1366

/**
 * 判断一个 error 是否是 number_id 唯一键冲突（crm_customer 或 crm_member_customer）。
 * 业务编号生成时，6 位 base36 随机有极小生日冲突概率，service 层用此判断做重试。
 */
export function isDuplicateNumberIdError(err: unknown): boolean {
  const e: any = (err as any)?.cause ?? err
  if (e?.errno !== ER_DUP_ENTRY) return false
  const sql = String(e?.sqlMessage ?? '')
  return /number_id|uniq_crm_(customer|member)_number_id/.test(sql)
}

/**
 * 把 mysql2 / Drizzle 抛出的 error 翻译成业务码。
 *
 * Drizzle 在 0.44+ 会把 driver 错误包成 `new DrizzleQueryError(...)`，原始的
 * mysql2 错误（带 errno / sqlMessage）放在 `error.cause` 上。兼容两种形态。
 */
export function translateDbError(err: unknown): never {
  const e: any = err
  const c: any = e?.cause
  const target = (c && (typeof c.errno === 'number' || typeof c.code === 'string')) ? c : e
  if (!target || typeof target.errno !== 'number') throw err
  if (target.errno === ER_DUP_ENTRY) {
    const sql = String(target.sqlMessage ?? '')
    if (sql.includes('number_id') || sql.includes('uniq_crm_customer_number_id')) {
      throw new BusinessError(
        ValidationErrorCode.PARAMETER_FORMAT_ERROR,
        '客户编号已存在',
      )
    }
    if (sql.includes('uniq_crm_member_number_id')) {
      throw new BusinessError(
        ValidationErrorCode.PARAMETER_FORMAT_ERROR,
        '会员编号已存在',
      )
    }
    throw new BusinessError(
      ResourceErrorCode.ALREADY_EXISTS,
      '数据已存在重复',
    )
  }
  if (target.errno === ER_DATA_TOO_LONG) {
    throw new BusinessError(
      ValidationErrorCode.PARAMETER_LENGTH_ERROR,
      '字段长度超过数据库限制',
    )
  }
  if (target.errno === ER_TRUNCATED_WRONG_VALUE) {
    throw new BusinessError(
      ValidationErrorCode.PARAMETER_FORMAT_ERROR,
      '字段值格式不正确',
    )
  }
  throw err
}

/**
 * 包装一个数据库调用；抛出 errno 时由 translateDbError 翻译成业务码。
 * 其它 error 原样抛出。
 */
export async function withDbErrorMapping<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    return translateDbError(err) as never
  }
}
