import type { AdminUser } from '@/api/admin/types'

export interface WorkbenchUserPanelProps {
  expanded: boolean
  onToggle: () => void
}

export interface UserListItemProps {
  user: AdminUser
  onClick: (user: AdminUser) => void
  onLongPress: (user: AdminUser) => void
}

export interface ActionMenuUser extends AdminUser {
  canWrite: boolean
  canDelete: boolean
}