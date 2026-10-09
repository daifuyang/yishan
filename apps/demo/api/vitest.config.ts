import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'
export default defineConfig({
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  test: { environment: 'node', include: ['test/**/*.test.ts', 'src/modules/**/tests/**/*.test.ts'], exclude: ['test/integration/**'], setupFiles: ['test/setup.ts'] },
})
