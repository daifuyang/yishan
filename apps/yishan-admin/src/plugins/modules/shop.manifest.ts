const shopManifest = {
  name: 'shop',
  version: '1.0.0',
  coreCompatibility: '^1.0.0',
  routes: [
    {
      path: '/plugins/yishan/shop/categories',
      component: './shop/categories',
      access: 'canDo',
      icon: 'folder',
    },
    {
      path: '/plugins/yishan/shop/attributes',
      component: './shop/attributes',
      access: 'canDo',
      icon: 'appstore',
    },
    {
      path: '/plugins/yishan/shop/products',
      component: './shop/products',
      access: 'canDo',
      icon: 'shopping',
    },
    {
      path: '/plugins/yishan/shop/skus',
      component: './shop/skus',
      access: 'canDo',
      icon: 'inbox',
    },
    {
      path: '/plugins/yishan/shop/orders',
      component: './shop/orders',
      access: 'canDo',
      icon: 'file-text',
    },
  ],
};

export default shopManifest;
