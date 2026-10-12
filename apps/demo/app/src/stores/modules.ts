import { create } from 'zustand'
import { menuApi } from '@/api'
import type { HomeAppIds, WorkbenchMenuNode } from '@/api/types'
import { loadIdentity, useAuthStore } from './auth'

interface ModuleState {
  menus: WorkbenchMenuNode[]
  /** 首页常用应用排序；接口不可用时为 null，首页退化为工作台顺序 */
  home: HomeAppIds | null
  loading: boolean
  error: string | null
  loaded: boolean
  load: (options?: { force?: boolean }) => Promise<void>
  savePins: (menuIds: readonly number[]) => Promise<void>
  reset: () => void
}

const CACHE_MS = 60_000
let loadedAt = 0
let generation = 0
/** 每次保存固定项后递增：保存前发出的 load 回来时不得用旧排序覆盖刚保存的结果 */
let homeVersion = 0
let inFlight: { force: boolean; promise: Promise<void> } | null = null
let ownerId: number | null = null
let syncingIdentity = false

/** 首页排序失败不影响工作台；旧后端没有该接口时同样返回 null */
async function loadHome(): Promise<HomeAppIds | null> {
  try {
    return await menuApi.getHomeApps()
  } catch {
    return null
  }
}

export const useModuleStore = create<ModuleState>((set, get) => ({
  menus: [],
  home: null,
  loading: false,
  error: null,
  loaded: false,
  async load(options = {}) {
    const auth = useAuthStore.getState()
    if (!auth.bootstrapped || !auth.token || !auth.user || auth.user.permissions === undefined)
      return
    const userId = auth.user.id
    if (ownerId !== userId) {
      get().reset()
      ownerId = userId
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
    const requestHomeVersion = homeVersion
    set({ loading: true, error: null })
    const request = (async () => {
      try {
        const [menus, home, identity] = await Promise.all([
          menuApi.getAuthorizedMenuTree(),
          loadHome(),
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
        loadedAt = Date.now()
        set({
          menus,
          home: homeVersion === requestHomeVersion ? (home ?? get().home) : get().home,
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
  async savePins(menuIds) {
    const auth = useAuthStore.getState()
    if (!auth.token || !auth.user || ownerId !== auth.user.id || !get().loaded) {
      throw new Error('请刷新应用列表后重试')
    }
    const userId = auth.user.id
    const requestGeneration = generation
    const home = await menuApi.saveHomePins(menuIds)
    if (generation !== requestGeneration || useAuthStore.getState().user?.id !== userId) {
      throw new Error('登录状态已变化，请重新登录')
    }
    homeVersion += 1
    set({ home })
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
      home: null,
    })
  },
}))

useAuthStore.subscribe((state, previous) => {
  if (syncingIdentity) return
  const authorizationChanged =
    JSON.stringify([state.user?.permissions, state.enabledModuleIds]) !==
    JSON.stringify([previous.user?.permissions, previous.enabledModuleIds])
  if (!state.token || state.user?.id !== previous.user?.id || authorizationChanged) {
    useModuleStore.getState().reset()
    // 请求由可见页面发起，避免鉴权刷新与菜单订阅互相触发重复请求。
    if (state.user && state.token) ownerId = state.user.id
  }
})
