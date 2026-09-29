import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    // 未设置 VITE_API_BASE_URL 时,通过开发代理访问本机后端
    proxy: {
      '/api': 'http://127.0.0.1:3001',
      '/health': 'http://127.0.0.1:3001',
    },
  },
  build: {
    outDir: 'dist',
  },
});
