import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'
export default defineConfig({
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  test: { environment: 'node', include: ['test/integration/**/*.test.ts'], hookTimeout: 120000, testTimeout: 30000 },
})
