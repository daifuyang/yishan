import { configUmiAlias, createConfig } from '@umijs/max/test.js';

export default async (): Promise<any> => {
  const config = await configUmiAlias({
    ...createConfig({
      target: 'browser',
    }),
  });
  return {
    ...config,
    testEnvironmentOptions: {
      ...(config?.testEnvironmentOptions || {}),
      url: 'http://localhost:8000',
    },
    setupFiles: [...(config.setupFiles || []), './tests/setupTests.jsx'],
    // 开启未退出句柄检测，便于定位异步资源泄漏
    detectOpenHandles: true,
    globals: {
      ...config.globals,
      localStorage: null,
      // 镜像 src 下对 Umi define 全局变量的引用（见 config/config.ts）。
      // 测试环境不跑 Umi 构建，必须显式注入，否则模块顶层就会 ReferenceError。
      __APP_BASE__: '/',
    },
  };
};
