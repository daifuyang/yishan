import { create } from 'zustand'

import * as authApi from '../api/auth'
import {
  getSessionVersion,
  invalidateSessionRequests,
  setTokenRefreshedHandler,
  setUnauthorizedHandler,
} from '../api/client'
import { RequestCancelledError, UnauthorizedError, type CurrentUser } from '../api/types'
import { redirectToLogin } from '../utils/router'
import { storage, STORAGE_KEYS } from '../utils/storage'

interface AuthState {
  token: string | null
  refreshToken: string | null
  user: CurrentUser | null
  enabledModuleIds: string[] | null
  bootstrapped: boolean
  bootstrapError: string | null
  loading: boolean
  bootstrap: (force?: boolean) => Promise<void>
  login: (params: authApi.LoginParams) => Promise<void>
  logout: () => Promise<void>
  refreshMe: () => Promise<void>
  setUser: (patch: Partial<CurrentUser>) => void
  clear: () => void
}

let bootstrapFlight: Promise<void> | undefined
let identityFlight:
  | { version: number; promise: Promise<{ user: CurrentUser; enabledModuleIds: string[] }> }
  | undefined

export function loadIdentity() {
  const version = getSessionVersion()
  if (identityFlight?.version === version) return identityFlight.promise
  const promise = Promise.all([authApi.getCurrentUser(), authApi.getCapabilities()]).then(
    ([user, capabilities]) => {
      if (version !== getSessionVersion()) throw new RequestCancelledError()
      return {
        user: { ...user, permissions: capabilities.permissions },
        enabledModuleIds: capabilities.enabledModuleIds,
      }
    },
  )
  const flight = { version, promise }
  identityFlight = flight
  void promise
    .finally(() => {
      if (identityFlight === flight) identityFlight = undefined
    })
    .catch(() => {})
  return promise
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: storage.get<string>(STORAGE_KEYS.ACCESS_TOKEN),
  refreshToken: storage.get<string>(STORAGE_KEYS.REFRESH_TOKEN),
  // A persisted profile cannot establish current permissions or a valid session.
  user: null,
  enabledModuleIds: null,
  bootstrapped: false,
  bootstrapError: null,
  loading: false,

  bootstrap(force = false) {
    if (bootstrapFlight) return bootstrapFlight
    if (get().bootstrapped && !force) return Promise.resolve()
    if (!get().token) {
      set({ bootstrapped: true, user: null, enabledModuleIds: null, bootstrapError: null })
      return Promise.resolve()
    }
    const version = getSessionVersion()
    set({ bootstrapped: false, bootstrapError: null })
    const flight = (async () => {
      try {
        const identity = await loadIdentity()
        if (version === getSessionVersion()) set({ ...identity, bootstrapped: true })
      } catch (error) {
        if (version !== getSessionVersion()) return
        if (error instanceof UnauthorizedError) get().clear()
        else
          set({
            bootstrapped: true,
            user: null,
            enabledModuleIds: null,
            bootstrapError: '无法恢复会话，请检查网络后重试',
          })
      }
    })()
    bootstrapFlight = flight
    void flight.finally(() => {
      if (bootstrapFlight === flight) bootstrapFlight = undefined
    })
    return flight
  },

  async login(params) {
    if (get().loading) return
    get().clear()
    const version = getSessionVersion()
    set({ loading: true })
    try {
      const data = await authApi.login(params)
      if (version !== getSessionVersion()) throw new RequestCancelledError()
      storage.set(STORAGE_KEYS.ACCESS_TOKEN, data.token)
      if (data.refreshToken) storage.set(STORAGE_KEYS.REFRESH_TOKEN, data.refreshToken)
      set({ token: data.token, refreshToken: data.refreshToken ?? null })
      const identity = await loadIdentity()
      if (version === getSessionVersion())
        set({ ...identity, bootstrapped: true, bootstrapError: null })
    } catch (error) {
      if (version === getSessionVersion()) get().clear()
      throw error
    } finally {
      if (version === getSessionVersion()) set({ loading: false })
    }
  },

  async logout() {
    const token = get().token
    const refreshToken = get().refreshToken
    get().clear()
    try {
      await authApi.logout(token, refreshToken)
    } catch {
      // Local logout is complete even if the revocation endpoint is unreachable.
    }
  },

  async refreshMe() {
    if (!get().bootstrapped || !get().user || !get().token) return
    const version = getSessionVersion()
    try {
      const identity = await loadIdentity()
      if (version === getSessionVersion()) set(identity)
    } catch {
      // Keep the current verified profile for temporary network failures; 401 is handled centrally.
    }
  },

  setUser(patch) {
    const user = get().user
    if (user) set({ user: { ...user, ...patch } })
  },

  clear() {
    invalidateSessionRequests()
    bootstrapFlight = undefined
    identityFlight = undefined
    storage.remove(STORAGE_KEYS.ACCESS_TOKEN)
    storage.remove(STORAGE_KEYS.REFRESH_TOKEN)
    storage.remove(STORAGE_KEYS.USER)
    set({
      token: null,
      refreshToken: null,
      user: null,
      enabledModuleIds: null,
      loading: false,
      bootstrapped: true,
      bootstrapError: null,
    })
  },
}))

let interceptorsInstalled = false
export function setupAuthInterceptor() {
  if (interceptorsInstalled) return
  interceptorsInstalled = true
  setUnauthorizedHandler(() => {
    useAuthStore.getState().clear()
    void redirectToLogin()
  })
  setTokenRefreshedHandler((data) => {
    useAuthStore.setState({ token: data.token, refreshToken: data.refreshToken ?? null })
  })
}
