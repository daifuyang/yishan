/**
 * Core admin routes. Pages live in src/pages/system/*. The plugin
 * management page was removed in the modules-autoload refactor; module
 * discovery is now driven by src/modules/ at boot.
 */
const coreAdminRoutes = {
  name: 'core',
  version: '1.0.0',
  coreCompatibility: '^2.0.0',
  routes: [
    {
      path: '/system/storage',
      component: './system/storage',
      access: 'canDo',
    },
    {
      path: '/system/attachments',
      component: './system/attachments',
      access: 'canDo',
    },
    {
      path: '/system/login-log',
      component: './system/login-log',
      access: 'canDo',
    },
  ],
}

export default coreAdminRoutes