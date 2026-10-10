/**
 * 写动作权限控制
 *  - 当 user.permissions 缺失（后端未下发）时默认拒绝，避免权限信息不完整时放行
 *  - 当传入多个 perm 时，全部满足才返回 true
 */
import { useAuthStore } from '@/stores/auth'
import { hasRequiredPermissions } from '@/modules/registry'

export function useCanWrite(...requiredPerms: string[]): boolean {
  const permissions = useAuthStore((s) => s.user?.permissions)
  const ready = useAuthStore((s) => s.bootstrapped && Boolean(s.token && s.user))

  return ready && hasRequiredPermissions(requiredPerms, permissions)
}
