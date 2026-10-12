import demoModule from './modules/demo/module'
import portalModule from './modules/portal/module'
import shopModule from './modules/shop/module'

/** Installation is explicit. CRM is available for a separate product manifest. */
export const demoModules = [demoModule, portalModule, shopModule] as const
