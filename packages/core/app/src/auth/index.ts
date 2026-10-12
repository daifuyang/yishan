import { create } from 'zustand'
import { RequestCancelledError, UnauthorizedError } from '../request/types'
import type { AuthOptions } from './options'
export type { AuthOptions } from './options'

export interface AuthState<User, Credentials> {
  token: string | null
  refreshToken: string | null
  user: User | null
  enabledModuleIds: string[] | null
  bootstrapped: boolean
  bootstrapError: string | null
  loading: boolean
  bootstrap: (force?: boolean) => Promise<void>
  login: (params: Credentials) => Promise<void>
  logout: () => Promise<void>
  refreshMe: () => Promise<void>
  setUser: (patch: Partial<User>) => void
  clear: () => void
}

/** Product API operations and navigation are injected; stores never share session state. */
export function createAuthStore<User extends { permissions?: string[] }, Credentials>(options: AuthOptions<User, Credentials>) {
  const { api: authApi, client, storage, storageKeys: STORAGE_KEYS, onUnauthorized } = options
  const { getSessionVersion, invalidateSessionRequests, setTokenRefreshedHandler, setUnauthorizedHandler } = client
  let bootstrapFlight: Promise<void> | undefined
  let identityFlight:
    | { version: number; promise: Promise<{ user: User; enabledModuleIds: string[] }> }
    | undefined

  function loadIdentity() {
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

  const useAuthStore = create<AuthState<User, Credentials>>((set, get) => ({
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
  function setupAuthInterceptor() {
    if (interceptorsInstalled) return
    interceptorsInstalled = true
    setUnauthorizedHandler(() => {
      useAuthStore.getState().clear()
      void onUnauthorized()
    })
    setTokenRefreshedHandler((data) => {
      useAuthStore.setState({ token: data.token, refreshToken: data.refreshToken ?? null })
    })
  }

  return { useAuthStore, loadIdentity, setupAuthInterceptor }
}
