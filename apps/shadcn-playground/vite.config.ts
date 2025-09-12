import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from "@tailwindcss/vite"

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  server: {
    watch: {
      ignored: [
        '!**/node_modules/@zerocmf/yishan-shadcn/**',
      ],
    },
  },
  optimizeDeps: {
    exclude: ['@zerocmf/yishan-shadcn'],
  },
})