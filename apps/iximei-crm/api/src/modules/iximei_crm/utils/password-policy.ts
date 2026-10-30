/**
 * 系统中所有"用户密码"校验规则的唯一来源。
 *
 * 覆盖范围:
 * - 创建/更新系统用户 (core/schemas/user.ts CreateUserReq / UpdateUserReq)
 * - 系统用户登录 (core/schemas/auth.ts LoginReq, 仅长度)
 * - 创建 CRM 医院含账号 (modules/crm/schemas/hospitals.schema.ts)
 * - 重置医院账号密码 (同上 reset-password)
 * - 业务层兜底 (core/services/user.service.ts validatePassword)
 *
 * 任何新增业务模块用到"用户密码"都必须从这里取, 不要手写 minLength/pattern。
 * 否则会再次出现 system 6 位 vs crm 8 位的分叉问题。
 */

export const PASSWORD_POLICY = {
  /** 最短长度 */
  minLength: 6,
  /** 最长长度 (scrypt v1 hash 输入无硬上限, 50 与历史系统保持一致) */
  maxLength: 50,
  /**
   * 复杂度正则: 至少一个字母 + 至少一个数字, 只允许 [a-zA-Z\d@$!%*?&]
   * 用 RegExp 字面, 给 service 层 validatePassword 用。
   */
  pattern: /^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]+$/,
  /**
   * pattern 的字面字符串, 给 TypeBox / Ajv 用。
   * 必须与 pattern 严格对应 —— 改 pattern 时这里也要同步改。
   */
  patternString: '^(?=.*[a-zA-Z])(?=.*\\d)[a-zA-Z\\d@$!%*?&]+$',
  /** 用户可读的中文提示文案, 各业务共用, 避免散落 */
  message: {
    minLength: (limit: number) => `长度不能少于 ${limit} 位`,
    maxLength: (limit: number) => `长度不能超过 ${limit} 位`,
    complexity: '必须包含字母和数字,只能使用字母、数字和 @$!%*?&',
  },
} as const

/**
 * 给 TypeBox password 字段用的属性 (minLength/maxLength/pattern 一次性产出)。
 * 形如:
 *   password: Type.String(passwordTypeBoxProps)
 */
export const passwordTypeBoxProps = {
  minLength: PASSWORD_POLICY.minLength,
  maxLength: PASSWORD_POLICY.maxLength,
  pattern: PASSWORD_POLICY.patternString,
} as const

/**
 * 登录场景专用的"仅长度" props。
 * 登录不应强制复杂度规则, 因为存量老 iximei 用户(###md5)的密码可能不满足复杂度,
 * 上线后会全部锁死。
 */
export const passwordLoginTypeBoxProps = {
  minLength: PASSWORD_POLICY.minLength,
  maxLength: PASSWORD_POLICY.maxLength,
} as const

/**
 * service 层用 policy 校验明文密码, 返回错误文案或 null。
 * 替代各业务模块手写的 validatePassword, 避免规则分叉。
 */
export function validatePasswordByPolicy(pwd: string): string | null {
  if (typeof pwd !== 'string' || pwd.length === 0) {
    return PASSWORD_POLICY.message.minLength(PASSWORD_POLICY.minLength)
  }
  if (pwd.length < PASSWORD_POLICY.minLength) {
    return PASSWORD_POLICY.message.minLength(PASSWORD_POLICY.minLength)
  }
  if (pwd.length > PASSWORD_POLICY.maxLength) {
    return PASSWORD_POLICY.message.maxLength(PASSWORD_POLICY.maxLength)
  }
  if (!PASSWORD_POLICY.pattern.test(pwd)) {
    return PASSWORD_POLICY.message.complexity
  }
  return null
}