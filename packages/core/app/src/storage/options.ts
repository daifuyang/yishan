export interface StorageAdapter {
  getStorageSync(key: string): unknown
  setStorageSync(key: string, value: unknown): unknown
  removeStorageSync(key: string): unknown
  clearStorageSync(): unknown
}

export interface SessionStorageKeys {
  readonly ACCESS_TOKEN: string
  readonly REFRESH_TOKEN: string
  readonly USER: string
}
