import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import postcss from "rollup-plugin-postcss";
import tailwindcss from "@tailwindcss/postcss";
import del from "rollup-plugin-delete";

export default {
  input: "index.ts",
  output: [
    { file: "dist/index.js", format: "cjs", sourcemap: true },
    { file: "dist/index.esm.js", format: "esm", sourcemap: true },
  ],
  external: ["react", "react-dom", "clsx", "class-variance-authority", "tailwind-merge"],
  plugins: [
    del({ targets: "dist" }),
    resolve({ browser: true }),
    commonjs(),
    typescript({
      tsconfig: "./tsconfig.json",
      declaration: true,
      outDir: "./dist",
    }),
    postcss({
      extract: "index.css",
      minimize: true,
      sourceMap: true,
      plugins: [tailwindcss()],
    }),
  ],
};
