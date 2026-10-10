import { AsyncLocalStorage } from 'node:async_hooks'
import { PermissionCatalog } from '../permission-catalog'
import type { PermissionRef } from '@yishan/core-contracts'
export type { PermissionRef } from '@yishan/core-contracts'

const scope = new AsyncLocalStorage<PermissionCatalog>()

export function runWithPermissions<T>(catalog: PermissionCatalog, operation: () => T): T {
  return scope.run(catalog, operation)
}

export function currentPermissionCatalog(): PermissionCatalog {
  const catalog = scope.getStore()
  if (!catalog) throw new Error('Permission operation requires an application scope')
  return catalog
}

export const registerPermissions = (...definitions: readonly PermissionRef[]): void => {
  currentPermissionCatalog().register(...definitions)
}

// The facade owns no definitions: every operation reads the explicit app scope.
export const PERMISSION_CODES: ReadonlySet<string> = {
  get size() { return currentPermissionCatalog().codes.size },
  has(code) { return currentPermissionCatalog().has(code) },
  keys() { return currentPermissionCatalog().codes.keys() },
  values() { return currentPermissionCatalog().codes.values() },
  entries() { return currentPermissionCatalog().codes.entries() },
  forEach(callback, thisArg) { currentPermissionCatalog().codes.forEach((value) => callback.call(thisArg, value, value, PERMISSION_CODES)) },
  [Symbol.iterator]() { return currentPermissionCatalog().codes[Symbol.iterator]() },
}

export const listPermissions = (): readonly PermissionRef[] => currentPermissionCatalog().listPermissions()
