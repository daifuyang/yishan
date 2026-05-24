const systemManifest = {
  name: 'system',
  version: '1.0.0',
  coreCompatibility: '^6.0.0',
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
    {
      path: '/system/apps',
      component: './system/apps',
      access: 'canDo',
    },
    {
      path: '/system/apps/:id',
      component: './system/apps/detail',
      layout: false,
      access: 'canDo',
    },
  ],
};

export default systemManifest;
