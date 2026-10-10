import type { PermissionRef } from '@yishan/core-contracts'
import { currentSystemRuntime } from './runtime'

export function registerRoutePermissions(...definitions: readonly PermissionRef[]): void {
  const runtime = currentSystemRuntime()
  for (const definition of definitions) {
    const previous = runtime.caches.routeDeclarations.get(definition.code)
    if (previous === definition) continue
    if (previous) throw new Error(`duplicate permission declaration: ${definition.code}`)
    runtime.permissions.register(definition)
    runtime.caches.routeDeclarations.set(definition.code, definition)
    runtime.caches.systemPermissionCodes.add(definition.code)
  }
}
