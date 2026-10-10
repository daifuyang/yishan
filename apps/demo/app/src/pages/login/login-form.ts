/**
 * 登录页纯逻辑：提交判定、错误文案映射、账号记忆。
 * 只服务登录页 UI，不参与 Token / 会话管理（会话仍由 stores/auth 负责）。
 */
import { ApiError, RequestCancelledError } from '@/api/types'
import { storage } from '@/utils/storage'

/** 与后端 loginReq schema 对齐 */
export const USERNAME_MAX_LENGTH = 100
export const PASSWORD_MIN_LENGTH = 6
export const PASSWORD_MAX_LENGTH = 50

/** 仅保存账号，绝不保存密码 */
export const REMEMBERED_ACCOUNT_KEY = 'yishan:app:login:rememberedAccount'

export function canSubmit(username: string, password: string): boolean {
  return username.trim().length > 0 && password.length > 0
}

/** 提交前的本地校验；返回 null 表示可以请求后端 */
export function validateLoginForm(username: string, password: string): string | null {
  if (!username.trim()) return '请输入账号'
  if (!password) return '请输入密码'
  if (password.length < PASSWORD_MIN_LENGTH) return `密码至少 ${PASSWORD_MIN_LENGTH} 位`
  return null
}

/** 后端业务码（packages/core/system-api/src/constants/business-codes） */
const LOGIN_FAILED = 22007
const ACCOUNT_LOCKED = 22008
const USER_DISABLED = 30003
const TOO_MANY_REQUESTS = 21008
const INVALID_PARAMETER = 21001
const VALIDATION_ERROR = 21007

/**
 * 把登录异常转换为面向用户的文案；不透出原始异常。
 * 返回 null 表示无需提示（例如会话切换导致的请求取消）。
 */
export function describeLoginError(error: unknown): string | null {
  if (error instanceof RequestCancelledError) return null
  if (!(error instanceof ApiError)) return '登录失败，请稍后重试'
  switch (error.code) {
    case -1:
      return '网络连接异常，请检查网络后重试'
    case LOGIN_FAILED:
      // 后端对「账号不存在」与「密码错误」统一返回该码，前端同样不区分
      return '账号或密码错误'
    case USER_DISABLED:
      return '账号已被禁用，请联系管理员'
    case ACCOUNT_LOCKED:
      return '账号已被锁定，请联系管理员'
    case TOO_MANY_REQUESTS:
      return error.message && error.message.length <= 40 ? error.message : '尝试次数过多，请稍后再试'
    case INVALID_PARAMETER:
    case VALIDATION_ERROR:
      return '请检查账号和密码格式'
  }
  if (error.httpStatus === 429) return '尝试次数过多，请稍后再试'
  if (error.code === -2 || (error.httpStatus ?? 0) >= 500) return '服务暂时不可用，请稍后重试'
  return '登录失败，请稍后重试'
}

export function readRememberedAccount(): string {
  const value = storage.get<unknown>(REMEMBERED_ACCOUNT_KEY)
  return typeof value === 'string' ? value.slice(0, USERNAME_MAX_LENGTH) : ''
}

export function saveRememberedAccount(username: string): void {
  const account = username.trim()
  if (account) storage.set(REMEMBERED_ACCOUNT_KEY, account)
  else storage.remove(REMEMBERED_ACCOUNT_KEY)
}

export function clearRememberedAccount(): void {
  storage.remove(REMEMBERED_ACCOUNT_KEY)
}
