/**
 * 跨端存储封装（H5 走 localStorage，小程序走 Taro 存储）
 */
import Taro from '@tarojs/taro'

export const storage = {
  get<T = unknown>(key: string, fallback: T | null = null): T | null {
    try {
      const v = Taro.getStorageSync(key)
      if (v === '' || v === null || v === undefined) return fallback
      return v as T
    } catch {
      return fallback
    }
  },

  set(key: string, value: unknown): void {
    try {
      Taro.setStorageSync(key, value)
    } catch {
      // ignore
    }
  },

  remove(key: string): void {
    try {
      Taro.removeStorageSync(key)
    } catch {
      // ignore
    }
  },

  clear(): void {
    try {
      Taro.clearStorageSync()
    } catch {
      // ignore
    }
  },
}

export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'yishan:app:accessToken',
  REFRESH_TOKEN: 'yishan:app:refreshToken',
  USER: 'yishan:app:user',
} as const
