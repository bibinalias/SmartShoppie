import { defineConfig } from 'vite';

export default defineConfig({
  base: '/SmartShoppie/',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: 'index.html',
    },
  },
});
