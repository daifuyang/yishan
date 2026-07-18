const helloManifest = {
  name: 'hello',
  version: '1.0.0',
  coreCompatibility: '^1.0.0',
  routes: [
    {
      path: '/plugins/yishan/hello/health',
      component: './hello/health',
      access: 'canDo',
    },
  ],
};

export default helloManifest;
