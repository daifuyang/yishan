import { definePermissions } from '../../../core/permissions/define-permissions.js';

export const helloPermissions = definePermissions({
  HEALTH_READ: { code: 'hello:health:read', label: '健康检查-读取', description: '读取 Hello 示例插件状态', group: 'hello' },
});

export default {
  pluginId: 'yishan/hello',
  dbNamespace: 'ys_hello',
  name: 'hello',
  menuRootName: 'Hello 示例',
  menuRootSort: 21,
  version: '1.0.0',
  coreCompatibility: '^1.0.0',
  channels: ['admin'],
  routeBase: '/api/modules/hello/v1',
  icon: 'smile',
  permissions: Object.values(helloPermissions),
  menus: [
    {
      channel: 'admin',
      path: '/plugins/yishan/hello/health',
      name: 'Hello Health',
      // Kept for the manifest architecture check; permissionCodes is the
      // runtime field consumed by PluginMenuSyncService.
      perm: helloPermissions.HEALTH_READ.code,
      permissionCodes: [helloPermissions.HEALTH_READ.code],
      icon: 'smile',
    },
  ],
  routes: [
    {
      path: '/plugins/yishan/hello/health',
      component: './hello/health',
      access: 'canDo',
    },
  ],
} as const;
