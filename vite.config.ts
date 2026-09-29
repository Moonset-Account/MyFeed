import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  server: {
    host: '127.0.0.1',
    strictPort: true
  },
  preview: {
    host: '127.0.0.1',
    strictPort: true
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
});
