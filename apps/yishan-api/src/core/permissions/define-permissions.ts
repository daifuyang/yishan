export interface PermissionRef { readonly code: string; readonly label: string; readonly group: string; readonly description?: string }

export function definePermissions<T extends Record<string, PermissionRef>>(permissions: T): Readonly<T> {
  const codes = new Set<string>();
  for (const permission of Object.values(permissions)) {
    if (!permission.code || !permission.label || !permission.group) throw new Error('permission declarations require code, label and group');
    if (codes.has(permission.code)) throw new Error(`duplicate permission declaration: ${permission.code}`);
    codes.add(permission.code); Object.freeze(permission);
  }
  return Object.freeze(permissions);
}
