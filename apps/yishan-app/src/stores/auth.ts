/**
 * 认证状态：token + 当前用户
 */
import { create } from 'zustand'

import { authApi, setUnauthorizedHandler } from '../api'
import { storage, STORAGE_KEYS } from '../utils/storage'
import type { CurrentUser, LoginData } from '../api/types'

interface AuthState {
  token: string | null
  refreshToken: string | null
  user: CurrentUser | null
  bootstrapped: boolean
  loading: boolean

  /** 启动时调用：读 storage，尝试拉 me */
  bootstrap: () => Promise<void>
  /** 登录并落库 */
  login: (params: { username: string; password: string; rememberMe?: boolean }) => Promise<void>
  /** 登出清空 */
  logout: () => Promise<void>
  /** 拉取当前用户（用于刷新 me） */
  refreshMe: () => Promise<void>
  /** 更新 user 局部字段（用于编辑资料后同步） */
  setUser: (patch: Partial<CurrentUser>) => void
  /** 清空状态（401 触发） */
  clear: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: storage.get<string>(STORAGE_KEYS.ACCESS_TOKEN),
  refreshToken: storage.get<string>(STORAGE_KEYS.REFRESH_TOKEN),
  user: storage.get<CurrentUser>(STORAGE_KEYS.USER),
  bootstrapped: false,
  loading: false,

  async bootstrap() {
    const { token } = get()
    if (!token) {
      set({ bootstrapped: true })
      return
    }
    try {
      const user = await authApi.getCurrentUser()
      set({ user, bootstrapped: true })
      storage.set(STORAGE_KEYS.USER, user)
    } catch {
      // token 失效，清空
      get().clear()
      set({ bootstrapped: true })
    }
  },

  async login(params) {
    set({ loading: true })
    try {
      const data: LoginData = await authApi.login(params)
      storage.set(STORAGE_KEYS.ACCESS_TOKEN, data.token)
      if (data.refreshToken) storage.set(STORAGE_KEYS.REFRESH_TOKEN, data.refreshToken)
      set({ token: data.token, refreshToken: data.refreshToken ?? null })

      const user = await authApi.getCurrentUser()
      storage.set(STORAGE_KEYS.USER, user)
      set({ user, bootstrapped: true })
    } finally {
      set({ loading: false })
    }
  },

  async logout() {
    try {
      await authApi.logout()
    } catch {
      // ignore
    }
    get().clear()
  },

  async refreshMe() {
    try {
      const user = await authApi.getCurrentUser()
      storage.set(STORAGE_KEYS.USER, user)
      set({ user })
    } catch {
      // ignore
    }
  },

  setUser(patch) {
    const next = { ...(get().user || ({} as CurrentUser)), ...patch }
    storage.set(STORAGE_KEYS.USER, next)
    set({ user: next })
  },

  clear() {
    storage.remove(STORAGE_KEYS.ACCESS_TOKEN)
    storage.remove(STORAGE_KEYS.REFRESH_TOKEN)
    storage.remove(STORAGE_KEYS.USER)
    set({ token: null, refreshToken: null, user: null })
  },
}))

/**
 * 在 401 时由 client 调用：清空 store + 跳登录
 * 在 app.ts 启动时注册一次
 */
export function setupAuthInterceptor() {
  setUnauthorizedHandler(() => {
    const { token, clear } = useAuthStore.getState()
    if (token) {
      clear()
    }
    // 跳转由 router 处理
    import('../utils/router').then(({ redirectToLogin }) => redirectToLogin())
  })
}
