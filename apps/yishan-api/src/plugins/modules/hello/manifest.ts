export default {
  pluginId: 'yishan/hello',
  name: 'hello',
  version: '1.0.0',
  coreCompatibility: '^1.0.0',
  channels: ['admin', 'public'],
  routeBase: '/api/modules/yishan/hello/v1',
  icon: 'smile',
  permissions: ['hello:health:read', 'hello:me:read'],
  menus: [
    {
      channel: 'admin',
      path: '/plugins/yishan/hello/health',
      name: 'Hello Health',
      perm: 'hello:health:read',
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
