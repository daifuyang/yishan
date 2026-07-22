/**
 * Admin 全局类型声明（项目级 ambient declarations）。
 *
 * - Umi 在构建时把 `__APP_BASE__` 注入为字符串字面量（见 config/config.ts
 *   的 defineConfig）。strict 模式下使用需 ambient 声明，否则报 TS2304。
 * - 静态资源、CSS Modules、monorepo workspace 的 side-effect css import
 *   没有自带 .d.ts，集中声明避免每个文件 inline 处理。
 *
 * 注意：
 *   - 运行时由 Umi `defineConfig` 注入；测试环境由 jest.config.ts 的
 *     `globals.__APP_BASE__` 注入（参见 tests/setupTests.jsx）。
 *   - 不在本文件中的资源类型，按需追加；保持最小集。
 */

// Umi define 全局变量
declare const __APP_BASE__: string;

// 静态资源（src/pages/**、@public/** 等相对/alias 路径 import 得到 default string）
declare module '*.png' {
  const src: string;
  export default src;
}
declare module '*.jpg' {
  const src: string;
  export default src;
}
declare module '*.jpeg' {
  const src: string;
  export default src;
}
declare module '*.gif' {
  const src: string;
  export default src;
}
declare module '*.svg' {
  const src: string;
  export default src;
}
declare module '*.webp' {
  const src: string;
  export default src;
}

// CSS Modules（less/scss/css 同形：默认导出类名映射）
declare module '*.module.less' {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}
declare module '*.module.scss' {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}
declare module '*.module.css' {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}

// yishan-tiptap 是 monorepo workspace package，package.json 的 `exports`
// 含 "./index.css" 但未附带 .d.ts；TS2882 在 strict 下要求显式声明。
declare module 'yishan-tiptap/index.css';

// mockjs 未安装 @types/mockjs。dev 模式 MOCK=none 不实际加载，仅类型 stub。
declare module 'mockjs';
