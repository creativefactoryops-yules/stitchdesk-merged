import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// VITE_HASH_ROUTER=1 builds the single-file phone preview (hash URLs, no server needed).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': 'http://localhost:8787' },
  },
  preview: {
    proxy: { '/api': 'http://localhost:8787' },
  },
  build: {
    target: 'es2020',
    sourcemap: false,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
} as any);
