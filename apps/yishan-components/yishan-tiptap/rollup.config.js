import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import peerDepsExternal from "rollup-plugin-peer-deps-external";
import dts from "rollup-plugin-dts";
import alias from "@rollup/plugin-alias";
import json from "@rollup/plugin-json";
import postcss from "rollup-plugin-postcss";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve as pathResolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// 自定义插件：清理类型定义中的 SCSS 导入
const cleanScssImports = () => ({
  name: 'clean-scss-imports',
  transform(code, id) {
    if (id.endsWith('.d.ts')) {
      return {
        code: code.replace(/^import\s+["'].*\.scss["']\s*;?\s*$/gm, ''),
        map: null
      };
    }
    return null;
  }
});

const packageJson = JSON.parse(readFileSync("./package.json", "utf8"));

export default [
  // 主构建配置
  {
    input: "src/index.ts",
    output: [
      {
        file: packageJson.main,
        format: "cjs",
        sourcemap: true,
      },
      {
        file: packageJson.module,
        format: "esm",
        sourcemap: true,
      },
    ],
    plugins: [
      peerDepsExternal(),
      json(),
      alias({
        entries: [
          { find: "@", replacement: pathResolve(__dirname, "src") }
        ]
      }),
      resolve(),
      commonjs(),
      typescript({
        tsconfig: "./tsconfig.json",
        exclude: ["**/*.test.ts", "**/*.test.tsx"],
      }),
      postcss({
        // 提取为独立 CSS 文件
        extract: "index.css",
        // 使用 sass
        use: ["sass"],
        // 开启 sourcemap
        sourceMap: true,
      }),
    ],
    external: ["react", "react-dom"],
  },
  // 类型定义构建配置
  {
    input: "dist/index.d.ts",
    output: [{ file: "dist/index.d.ts", format: "es" }],
    plugins: [
      cleanScssImports(), // 先清理 SCSS 导入
      dts(),
    ],
    external: ["react", "react-dom"],
  },
];
