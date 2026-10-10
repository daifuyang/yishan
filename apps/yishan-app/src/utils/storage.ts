import Taro from '@tarojs/taro'
import { createStorage } from '@yishan/core-app/storage'

export const storage = createStorage({
  // Taro's platform API is populated after the application modules are evaluated.
  getStorageSync: (key) => Taro.getStorageSync(key),
  setStorageSync: (key, value) => Taro.setStorageSync(key, value),
  removeStorageSync: (key) => Taro.removeStorageSync(key),
  clearStorageSync: () => Taro.clearStorageSync(),
})

export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'yishan:app:accessToken',
  REFRESH_TOKEN: 'yishan:app:refreshToken',
  USER: 'yishan:app:user',
} as const
