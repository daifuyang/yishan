export function hasRequiredPermissions(
  required: readonly string[],
  permissions?: readonly string[],
): boolean {
  return permissions !== undefined && required.every((code) => permissions.includes(code))
}
