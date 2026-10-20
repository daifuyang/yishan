import { configUmiAlias, createConfig } from '@umijs/max/test.js';

export default async (): Promise<any> => {
  const config = await configUmiAlias({
    ...createConfig({
      target: 'browser',
    }),
  });
  return {
    ...config,
    // Jest 只按默认扩展名表解析模块；public 下的图片靠真实文件存在即可被 jest.mock
    // 替换，因此必须把 webp 等图片扩展名登记进来，否则 .webp 资源一律解析失败。
    moduleFileExtensions: [
      ...(config.moduleFileExtensions || [
        'js',
        'mjs',
        'cjs',
        'jsx',
        'ts',
        'tsx',
        'json',
        'node',
      ]),
      'png',
      'jpg',
      'jpeg',
      'gif',
      'webp',
      'svg',
      'avif',
    ],
    testEnvironmentOptions: {
      ...(config?.testEnvironmentOptions || {}),
      url: 'http://localhost:8000',
    },
    setupFiles: [...(config.setupFiles || []), './tests/setupTests.jsx'],
    // 开启未退出句柄检测，便于定位异步资源泄漏。
    //
    // 但 Jest 规定这个选项**隐含 --runInBand**：整份测试被强制单线程跑。
    // CI 上 admin 的测试因此要 4m40s，是整条流水线最长的一条线。CI 里不需要
    // 查泄漏（那是本地排查用的），关掉它让 jest 按核数并行，
    // admin 那条线从 6m30s 降到 2m30s 左右。
    detectOpenHandles: !process.env.CI,
    // 少了 detectOpenHandles 之后，测试里没关掉的句柄会让 jest 打印
    // "Jest did not exit one second after..." 并一直挂着。CI 里强制退出，
    // 免得作业卡到超时。泄漏本身是本地排查的事（本地仍然开着检测）。
    forceExit: !!process.env.CI,
    globals: {
      ...config.globals,
      'jest-esbuild': { jsx: 'automatic' },
      localStorage: null,
      // 镜像 src 下对 Umi define 全局变量的引用（见 config/config.ts）。
      // 测试环境不跑 Umi 构建，必须显式注入，否则模块顶层就会 ReferenceError。
      __APP_BASE__: '/',
      __API_BASE_URL__: '',
      __INSTALLED_MODULE_IDS__: ['demo', 'portal', 'shop'],
    },
  };
};
