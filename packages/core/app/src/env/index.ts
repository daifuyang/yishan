export interface MobileEnvironment {
  apiBaseUrl: string
  mode: 'development' | 'test' | 'production'
}

/** The application supplies its build-time URL and mode; this package owns no product target. */
export function createMobileEnvironment(options: MobileEnvironment): Readonly<MobileEnvironment> {
  return Object.freeze({ ...options })
}
