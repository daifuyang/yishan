/**
 * 业务编号工具：客户/会员共用 CUSYYYYMMDDXXXXXX 格式（17 字符，无分隔符）。
 *
 * 设计：
 * - 历史 12059 行客户 + 2 行会员的 VIP/CUS 老数据不动。
 * - 新数据按"创建日期 + 6 位随机"生成：
 *   - 日期段：保留时间序，年度归档/跨年审计友好，客服一眼看出"何时建的"。
 *   - 6 位 base36 随机（A-Z 0-9）：36^6 ≈ 21.7 亿组合空间，单日 1000 条生日冲突
 *     概率 ~0.023%，靠 UNIQUE 索引 + service 层 1062 重试兜底。
 *   - 不可推算当日新增量（无 NNNN 段），比对日期段规则更"无泄漏"。
 * - 客户与会员共用 CUS 命名空间——通过表名（crm_customer / crm_member_customer）区分实体。
 * - 总长 17 字符，VARCHAR(20) 留 3 字符 buffer 应付未来加前缀/后缀。
 *
 * 形似国内会员卡号（17 位大写字母+数字，常见于 Costco/山姆/航司会员卡）。
 */

import { randomInt } from 'node:crypto'
import { dateUtils } from '@/modules/iximei_crm/utils/date'

const BASE36 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

/** 6 位 uppercase base36 随机串；用 crypto.randomInt 保证无偏分布 */
function randomTail(len = 6): string {
  let s = ''
  for (let i = 0; i < len; i++) s += BASE36[randomInt(0, 36)]
  return s
}

/** 把 Date 格式化成 YYYYMMDD（Asia/Shanghai 日历日，与客服认知一致） */
export function ymdOf(d: Date): string {
  return dateUtils.formatShanghaiYmd(d).replaceAll('-', '')
}

/** 本地时区今日 YYYYMMDD */
export const todayYmd = (): string => ymdOf(new Date())

/**
 * 拼出 CUSYYYYMMDDXXXXXX 字符串（17 字符，无分隔符）。
 * - 形如 CUS20260728A3K2M9
 * - 同日多条不会撞号（UNIQUE 索引 + 上层重试）；跨年/月可按日期段快速过滤
 * - 6 位 base36 随机：客服电话里也好念（"A3K2M9" 4 段念法）
 */
export function formatBusinessNumber(ymd: string): string {
  return `CUS${ymd}${randomTail(6)}`
}
