// Identity-only exceptions belong to System, never the generic route registrar.
export const BYPASS_CODES: ReadonlySet<string> = new Set([
  'auth:login', 'auth:refresh', 'app:auth:login', 'app:auth:refresh',
  'system:cron', 'system:health', 'system:options:public',
])

export const isBypassCode = (code: string): boolean => BYPASS_CODES.has(code)
