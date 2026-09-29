import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const runtime = globalThis as { process?: { env?: Record<string, string | undefined> } };
const apiTarget = runtime.process?.env?.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    strictPort: true,
    proxy: {
      '/api': apiTarget,
    },
  },
});
