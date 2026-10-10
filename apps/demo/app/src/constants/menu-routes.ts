import type { SysMenuNode } from '@/api/types'
import { getMobileModule, normalizePage } from '@/modules/registry'
import { TAB_PAGES } from './routes'
import { isRegisteredPage } from './page-config'

export type ResolvedRoute =
  | { type: 'page'; url: string }
  | { type: 'tab'; url: string }
  | { type: 'none' }

const TAB_PATHS: Record<string, string> = {
  index: TAB_PAGES.home,
  apps: TAB_PAGES.apps,
  mine: TAB_PAGES.mine,
}

/** Route identity comes from an explicit server path, never a display label. */
export function resolveMenuRoute(menu: SysMenuNode): ResolvedRoute {
  if (
    menu.type !== 1 ||
    menu.status !== '1' ||
    menu.hideInMenu ||
    menu.isExternalLink ||
    !menu.path
  )
    return { type: 'none' }
  const tab = TAB_PATHS[normalizePage(menu.path)]
  if (tab) return { type: 'tab', url: `/${tab}` }
  const module = getMobileModule(menu)
  return module &&
    module.implemented !== false &&
    module.showInWorkbench !== false &&
    isRegisteredPage(module.entry)
    ? { type: 'page', url: `/${module.entry}` }
    : { type: 'none' }
}
