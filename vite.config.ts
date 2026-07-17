import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'https://dev-hub.storymee.com',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('reactflow') || id.includes('@reactflow')) {
              return 'vendor-reactflow';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-lucide';
            }
            if (id.includes('react') || id.includes('react-dom') || id.includes('scheduler')) {
              return 'vendor-react-core';
            }
            return 'vendor-libs';
          }
          if (id.includes('src/lib/cinematic-engine')) {
            return 'cinematic-engine';
          }
          if (id.includes('src/utils/scriptParser') || id.includes('src/components/ScriptEditor')) {
            return 'script-parser';
          }
          if (id.includes('src/utils/mediaGateway')) {
            return 'media-gateway';
          }
          if (id.includes('src/services/api')) {
            return 'api-service';
          }
        }
      }
    },
    chunkSizeWarningLimit: 800
  }
})
