import { create } from 'zustand'
import { menuApi } from '@/api'
import type { SysMenuNode } from '@/api/types'
import { API_BASE_URL } from '@/config'
import { getWorkbenchGroups } from '@/modules/registry'
import { storage } from '@/utils/storage'
import { loadIdentity, useAuthStore } from './auth'

interface ModuleState {
  menus: SysMenuNode[]
  loading: boolean
  error: string | null
  loaded: boolean
  commonModuleIds: string[]
  commonConfigured: boolean
  load: (options?: { force?: boolean }) => Promise<void>
  setCommonModules: (ids: readonly string[]) => void
  reset: () => void
}

export const MAX_COMMON_APPS = 8
const CACHE_MS = 60_000
let loadedAt = 0
let generation = 0
let inFlight: { force: boolean; promise: Promise<void> } | null = null
let ownerId: number | null = null
let syncingIdentity = false

function commonKey(userId: number): string {
  // 当前为单租户部署；不同 API 部署与账号的偏好互不共享。
  return `yishan:app:common-modules:v2:${encodeURIComponent(API_BASE_URL || 'same-origin')}:${userId}`
}

function commonFor(userId: number): string[] | null {
  const saved = storage.get<unknown>(commonKey(userId))
  return Array.isArray(saved)
    ? [...new Set(saved.filter((id): id is string => typeof id === 'string'))].slice(
        0,
        MAX_COMMON_APPS,
      )
    : null
}

export const useModuleStore = create<ModuleState>((set, get) => ({
  menus: [],
  loading: false,
  error: null,
  loaded: false,
  commonModuleIds: [],
  commonConfigured: false,
  async load(options = {}) {
    const auth = useAuthStore.getState()
    if (!auth.bootstrapped || !auth.token || !auth.user || auth.user.permissions === undefined)
      return
    const userId = auth.user.id
    if (ownerId !== userId) {
      get().reset()
      ownerId = userId
      const saved = commonFor(userId)
      set({ commonModuleIds: saved ?? [], commonConfigured: saved !== null })
    }
    if (inFlight) {
      if (options.force && !inFlight.force) {
        const requestGeneration = generation
        await inFlight.promise
        if (generation === requestGeneration) await get().load({ force: true })
        return
      }
      return inFlight.promise
    }
    if (!options.force && get().loaded && Date.now() - loadedAt < CACHE_MS) return
    const requestGeneration = generation
    set({ loading: true, error: null })
    const request = (async () => {
      try {
        const [menus, identity] = await Promise.all([
          menuApi.getAuthorizedMenuTree(),
          options.force ? loadIdentity() : Promise.resolve(null),
        ])
        if (generation !== requestGeneration || useAuthStore.getState().user?.id !== userId) return
        if (identity) {
          if (identity.user.id !== userId) throw new Error('账号信息已变化，请重新登录')
          syncingIdentity = true
          try {
            useAuthStore.setState(identity)
          } finally {
            syncingIdentity = false
          }
        }
        const current = useAuthStore.getState()
        const available = getWorkbenchGroups(
          menus,
          current.user?.permissions,
          current.enabledModuleIds,
        ).flatMap((group) => group.apps)
        const saved = commonFor(userId)
        const commonModuleIds = (saved ?? available.map((app) => app.id))
          .filter((id) => available.some((app) => app.id === id))
          .slice(0, MAX_COMMON_APPS)
        loadedAt = Date.now()
        set({
          menus,
          commonModuleIds,
          commonConfigured: saved !== null,
          loaded: true,
          error: null,
        })
      } catch (error) {
        if (generation !== requestGeneration) return
        set({ error: error instanceof Error ? error.message : '应用加载失败' })
      } finally {
        if (generation === requestGeneration) {
          inFlight = null
          set({ loading: false })
        }
      }
    })()
    inFlight = { force: Boolean(options.force), promise: request }
    return request
  },
  setCommonModules(ids) {
    const auth = useAuthStore.getState()
    if (!auth.token || !auth.user || ownerId !== auth.user.id || !get().loaded || get().error) {
      throw new Error('请刷新应用列表后重试')
    }
    const available = getWorkbenchGroups(
      get().menus,
      auth.user.permissions,
      auth.enabledModuleIds,
    ).flatMap((group) => group.apps)
    const next = [...new Set(ids)]
      .filter((id) => available.some((app) => app.id === id))
      .slice(0, MAX_COMMON_APPS)
    const key = commonKey(auth.user.id)
    storage.set(key, next)
    if (JSON.stringify(storage.get(key)) !== JSON.stringify(next)) {
      throw new Error('常用应用保存失败，请检查存储空间后重试')
    }
    set({ commonModuleIds: next, commonConfigured: true })
  },
  reset() {
    generation += 1
    inFlight = null
    loadedAt = 0
    ownerId = null
    set({
      menus: [],
      loading: false,
      loaded: false,
      error: null,
      commonModuleIds: [],
      commonConfigured: false,
    })
  },
}))

useAuthStore.subscribe((state, previous) => {
  if (syncingIdentity) return
  const authorizationChanged =
    JSON.stringify([state.user?.permissions, state.user?.accessPath, state.enabledModuleIds]) !==
    JSON.stringify([
      previous.user?.permissions,
      previous.user?.accessPath,
      previous.enabledModuleIds,
    ])
  if (!state.token || state.user?.id !== previous.user?.id || authorizationChanged) {
    useModuleStore.getState().reset()
    // 请求由可见页面发起，避免鉴权刷新与菜单订阅互相触发重复请求。
    if (state.user && state.token) {
      ownerId = state.user.id
      const saved = commonFor(state.user.id)
      useModuleStore.setState({ commonModuleIds: saved ?? [], commonConfigured: saved !== null })
    }
  }
})
