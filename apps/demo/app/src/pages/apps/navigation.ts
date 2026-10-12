import { menuApi } from '@/api'
import { getWorkbenchGroups } from '@/modules/registry'
import { useAuthStore } from '@/stores/auth'
import { useModuleStore } from '@/stores/modules'
import { navigateTo } from '@/utils/router'

let navigating = false

export async function openWorkbenchApp(id: string): Promise<void> {
  if (navigating) return
  navigating = true
  const ownerId = useAuthStore.getState().user?.id
  try {
    await useModuleStore.getState().load({ force: true })
    const auth = useAuthStore.getState()
    const catalog = useModuleStore.getState()
    if (!auth.token || !auth.user || auth.user.id !== ownerId || !catalog.loaded) {
      throw new Error('登录状态已变化，请重新登录')
    }
    if (catalog.error) throw new Error('应用信息刷新失败，请重试')
    const app = getWorkbenchGroups(catalog.menus, auth.user.permissions, auth.enabledModuleIds)
      .flatMap((group) => group.apps)
      .find((app) => app.id === id)
    if (!app) throw new Error('应用已不可用或访问权限已变更')
    await navigateTo(`/${app.entry}`)
    // 使用记录只服务首页推荐：不等待、不提示，接口缺失或失败都不影响打开应用
    void Promise.resolve()
      .then(() => menuApi.reportAppUsage(app.menuId))
      .catch(() => undefined)
  } finally {
    navigating = false
  }
}
