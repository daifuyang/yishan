import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'
export default defineConfig({ resolve: { alias: { '@': resolve(__dirname,'src') } }, test: { globals:true, include: ['test/**/*.test.ts','tests/**/*.test.ts','src/**/test/**/*.test.ts'], exclude:['test/integration/**'], setupFiles:['test/setup.ts'] } })
