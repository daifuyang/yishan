/** Normalizes registered page identities without owning product routes. */
export function normalizePage(path: string): string {
  return path.split('?')[0].replace(/^\/+/, '').replace(/\/+$/, '')
}
