import type { PermissionRef } from '@yishan/core-contracts'
export type { PermissionRef } from '@yishan/core-contracts'

export class PermissionCatalog {
  private readonly definitions = new Map<string, PermissionRef>()

  register(...definitions: readonly PermissionRef[]): void {
    for (const definition of definitions) {
      if (!definition.code || !definition.label || !definition.group) {
        throw new Error('permission declaration requires code, label and group')
      }
      if (this.definitions.has(definition.code)) {
        throw new Error(`duplicate permission declaration: ${definition.code}`)
      }
      this.definitions.set(definition.code, Object.freeze({ ...definition }))
    }
  }

  has(code: string): boolean {
    return this.definitions.has(code)
  }

  get codes(): ReadonlySet<string> {
    return new Set(this.definitions.keys())
  }

  listPermissions(): readonly PermissionRef[] {
    return Object.freeze([...this.definitions.values()])
  }
}
