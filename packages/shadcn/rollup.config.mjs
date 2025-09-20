import fs from 'node:fs';
import { defineConfig } from 'rollup';
import nodeResolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import alias from '@rollup/plugin-alias';
import preserveDirectives from 'rollup-preserve-directives';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import postcss from 'rollup-plugin-postcss';

const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url)));

const externalDeps = [
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.peerDependencies || {}),
];

// Absolute path to the package root (this rollup config is located in the package root)
const packageRoot = fileURLToPath(new URL('./', import.meta.url));

export default defineConfig({
  input: ['index.ts'],
  output: [
    {
      dir: 'dist/esm',
      format: 'esm',
      preserveModules: true,
      preserveModulesRoot: '.',
      sourcemap: true,
      entryFileNames: '[name].js',
    },
    {
      dir: 'dist/cjs',
      format: 'cjs',
      preserveModules: true,
      preserveModulesRoot: '.',
      sourcemap: true,
      entryFileNames: '[name].cjs',
    },
  ],
  external: (id) => {
    if (externalDeps.some((dep) => id === dep || id.startsWith(`${dep}/`))) return true;
    return false;
  },
  plugins: [
    alias({ entries: [{ find: /^@\//, replacement: path.join(packageRoot, '/') }] }),
    nodeResolve({ extensions: ['.mjs', '.js', '.json', '.ts', '.tsx', '.jsx'] }),
    commonjs(),
    postcss({ extract: 'index.css', minimize: true, modules: false, use: ['less'] }),
    typescript({ tsconfig: './tsconfig.json', declaration: false }),
    preserveDirectives(),
  ],
  treeshake: { moduleSideEffects: false },
});