/**
 * Core admin routes — declared here (not under plugins/modules/) so that
 * they don't masquerade as a plugin. The admin route generator reads this
 * file alongside catalog-driven plugin.ts manifests.
 *
 * Page components remain in src/pages/system/* (not moved to plugins/),
 * because Core pages are not plugins.
 *
 * See specs/baseline-v2/decisions/ADR-002-plugin-sdk.md step 6.
 */
const coreAdminRoutes = {
  name: 'core',
  version: '1.0.0',
  coreCompatibility: '^2.0.0',
  routes: [
    {
      path: '/system/plugins',
      component: './system/plugins',
      access: 'canDo',
    },
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