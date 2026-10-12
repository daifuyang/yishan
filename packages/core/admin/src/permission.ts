export function checkPermission(permissions: readonly string[] | undefined, code: string): boolean {
  return permissions === undefined || permissions.includes(code)
}

export function canAccessPath(user: { accessPath?: readonly string[] } | undefined, path: string): boolean {
  return user?.accessPath?.includes(path) ?? false
}
