import { useEffect, useRef } from 'react'
import { useRouter } from '@tarojs/taro'
import { useAuthStore } from '@/stores/auth'
import { useModuleStore } from '@/stores/modules'
import {
  getMobileModuleById,
  getModuleForPage,
  hasRequiredPermissions,
  isMobileModuleAuthorized,
  isModuleEnabled,
  type MobileModule,
} from '@/modules/registry'
import { redirectToLogin } from './router'
import { getSessionVersion } from '@/api/client'

export function canAccessModule(
  module: MobileModule | undefined,
  permissions?: readonly string[],
  enabledModuleIds?: readonly string[] | null,
  requiredPermissions?: readonly string[],
): boolean {
  return Boolean(
    module &&
      module.implemented !== false &&
      hasRequiredPermissions(requiredPermissions ?? module.permissions, permissions) &&
      isModuleEnabled(module, enabledModuleIds),
  )
}

export interface RequireAuthOptions {
  moduleId?: string
}

/** Recheck current capabilities after an asynchronous confirmation or form load. */
export function canWriteModuleNow(moduleId: string, requiredPermissions: readonly string[]): boolean {
  const auth = useAuthStore.getState()
  const modules = useModuleStore.getState()
  const module = getMobileModuleById(moduleId)
  return Boolean(auth.bootstrapped && auth.token && auth.user && module && modules.loaded &&
    isMobileModuleAuthorized(module, modules.menus, auth.user.permissions, auth.enabledModuleIds) &&
    hasRequiredPermissions(requiredPermissions, auth.user.permissions))
}

export function useCurrentModuleAccess(moduleId: string) {
  const mounted = useRef(true)
  const session = useRef(getSessionVersion()).current
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  return (requiredPermissions: readonly string[] = []) => mounted.current && session === getSessionVersion() && canWriteModuleNow(moduleId, requiredPermissions)
}

export function useRequireAuth(options: RequireAuthOptions = {}): {
  ready: boolean
  loggedIn: boolean
  allowed: boolean
  denied: boolean
  accessLoading: boolean
  accessError: string | null
} {
  const router = useRouter()
  const bootstrapped = useAuthStore((state) => state.bootstrapped)
  const token = useAuthStore((state) => state.token)
  const user = useAuthStore((state) => state.user)
  const enabledModuleIds = useAuthStore((state) => state.enabledModuleIds)
  const menus = useModuleStore((state) => state.menus)
  const menusLoaded = useModuleStore((state) => state.loaded)
  const menuError = useModuleStore((state) => state.error)
  const page = getModuleForPage(router.path)
  const module =
    page?.module ?? (options.moduleId ? getMobileModuleById(options.moduleId) : undefined)
  const required = page?.editUser
    ? ['system:user:list', router.params.id ? 'system:user:update' : 'system:user:create']
    : page?.permissions
  const loggedIn = Boolean(token && user)
  const ready = bootstrapped && loggedIn
  const protectedPage = Boolean(page || options.moduleId)
  const allowed =
    ready &&
    (!protectedPage ||
      Boolean(
        module &&
          menusLoaded &&
          isMobileModuleAuthorized(module, menus, user?.permissions, enabledModuleIds) &&
          canAccessModule(module, user?.permissions, enabledModuleIds, required),
      ))

  useEffect(() => {
    if (bootstrapped && !token) redirectToLogin()
  }, [bootstrapped, token])

  useEffect(() => {
    if (ready && protectedPage) void useModuleStore.getState().load()
  }, [ready, protectedPage, user?.id])

  return {
    ready,
    loggedIn,
    allowed,
    denied: ready && protectedPage && menusLoaded && !allowed,
    accessLoading: ready && protectedPage && !menusLoaded && !menuError,
    accessError: protectedPage ? menuError : null,
  }
}
