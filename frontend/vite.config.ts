import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        // Inside Docker: ADMIN_SERVICE_URL=http://admin-service:8002 (set in docker-compose)
        // Outside Docker (npm run dev on host): falls back to localhost:8002
        target: process.env.ADMIN_SERVICE_URL ?? 'http://localhost:8002',
        changeOrigin: true,
      },
    },
  },
})
