import { createComponentResolver } from '@yishan/core-admin/components'
import { moduleComponentsMap } from '@@/module-components'

export const resolve = createComponentResolver(moduleComponentsMap)

export function debugKeys() {
  const keys = Object.keys(moduleComponentsMap)
  return { core: keys.filter(key => !key.startsWith('./modules/')), module: keys.filter(key => key.startsWith('./modules/')) }
}
