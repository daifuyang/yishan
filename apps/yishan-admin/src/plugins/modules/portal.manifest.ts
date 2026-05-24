const portalManifest = {
  name: 'portal',
  version: '1.0.0',
  coreCompatibility: '^6.0.0',
  routes: [
    {
      path: '/plugins/yishan/portal/articles',
      component: './portal/articles',
      access: 'canDo',
    },
    {
      path: '/plugins/yishan/portal/categories',
      component: './portal/categories',
      access: 'canDo',
    },
    {
      path: '/plugins/yishan/portal/pages',
      component: './portal/pages',
      access: 'canDo',
    },
    {
      path: '/plugins/yishan/portal/article-templates',
      component: './portal/article-templates',
      access: 'canDo',
    },
    {
      path: '/plugins/yishan/portal/page-templates',
      component: './portal/page-templates',
      access: 'canDo',
    },
  ],
};

export default portalManifest;
