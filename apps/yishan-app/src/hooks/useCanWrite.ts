/**
 * 写动作权限控制
 *  - 当 user.permissions 缺失（后端未下发）时，默认放行（true），等接口到位后自动收紧
 *  - 当传入多个 perm 时，全部满足才返回 true
 */
import { useAuthStore } from '@/stores/auth'

export function useCanWrite(...requiredPerms: string[]): boolean {
  const permissions = useAuthStore((s) => s.user?.permissions)

  // TODO: 后端 /api/v1/app/auth/me 暂未下发 permissions 字段。
  // 缺失时暂时放行以避免阻塞 UI；接口到位后改为 permissions === undefined ? false : ...
  if (permissions === undefined) return true
  if (requiredPerms.length === 0) return true
  return requiredPerms.every((p) => permissions.includes(p))
}
