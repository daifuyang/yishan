// postcss.config.mjs
import autoprefixer from 'autoprefixer';
import postcssImport from 'postcss-import';

// IMPORTANT: Do NOT run Tailwind inside the library build.
// We want to ship raw CSS (with @theme/@layer directives) and let the consuming app
// process Tailwind v4 via its own build pipeline (@tailwindcss/vite).
export default {
  plugins: [
    postcssImport(), // 解析 @import "tw-animate-css" 与其它 CSS 导入
    // 不在库内执行 tailwind()，避免缺少 @theme 命名空间（如 --spacing）时报错
    autoprefixer(),  // 添加浏览器前缀
  ],
};