import { EmptyState } from './EmptyState'

export function PermissionDenied() {
  return <EmptyState text="无权访问" hint="请联系管理员开通此功能权限" />
}

export default PermissionDenied
