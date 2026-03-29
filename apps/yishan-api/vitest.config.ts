import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': '/src',
      '@generated': '/src/generated',
      '@modules': '/src/plugins/modules'
    }
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts', 'src/**/test/**/*.test.ts'],
    setupFiles: ['test/setup.ts'],
    globals: true,
    coverage: {
      reporter: ['text', 'html']
    }
  }
})
