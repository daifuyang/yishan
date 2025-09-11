// postcss.config.mjs
import autoprefixer from 'autoprefixer';
import postcssImport from 'postcss-import';

export default {
  plugins: [
    postcssImport,       // 处理 @import
    autoprefixer,         // 添加浏览器前缀
  ],
};