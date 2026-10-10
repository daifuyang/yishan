/**
 * 跨端存储封装（H5 走 localStorage，小程序走 Taro 存储）
 */
import type { StorageAdapter } from './options'
export type { StorageAdapter, SessionStorageKeys } from './options'

export function createStorage(adapter: StorageAdapter) {
  return {
    get<T = unknown>(key: string, fallback: T | null = null): T | null {
      try {
        const v = adapter.getStorageSync(key)
        if (v === '' || v === null || v === undefined) return fallback
        return v as T
      } catch {
        return fallback
      }
    },

    set(key: string, value: unknown): void {
      try {
        adapter.setStorageSync(key, value)
      } catch {
        // ignore
      }
    },

    remove(key: string): void {
      try {
        adapter.removeStorageSync(key)
      } catch {
        // ignore
      }
    },

    clear(): void {
      try {
        adapter.clearStorageSync()
      } catch {
        // ignore
      }
    },
  }
}

export type Storage = ReturnType<typeof createStorage>
