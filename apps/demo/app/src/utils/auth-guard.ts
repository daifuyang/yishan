import { useEffect } from 'react'
import { useRouter } from '@tarojs/taro'
import { useAuthStore } from '@/stores/auth'
import { useModuleStore } from '@/stores/modules'
import {
  getMobileModuleById,
  getModuleForPage,
  hasRequiredPermissions,
  isMobileModuleAuthorized,
  isModuleEnabled,
  normalizePage,
  type MobileModule,
} from '@/modules/registry'
import { redirectToLogin } from './router'

export function canAccessModule(
  module: MobileModule | undefined,
  accessPath: readonly string[] | undefined,
  permissions?: readonly string[],
  enabledModuleIds?: readonly string[] | null,
  requiredPermissions?: readonly string[],
): boolean {
  return Boolean(
    module &&
      module.implemented !== false &&
      accessPath?.some((path) => normalizePage(path) === normalizePage(module.backendMenuPath)) &&
      hasRequiredPermissions(requiredPermissions ?? module.permissions, permissions) &&
      isModuleEnabled(module, enabledModuleIds),
  )
}

export interface RequireAuthOptions {
  moduleId?: string
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
          canAccessModule(module, user?.accessPath, user?.permissions, enabledModuleIds, required),
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
