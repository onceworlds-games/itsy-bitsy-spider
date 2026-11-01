import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { outDir: 'dist', assetsInlineLimit: 0, target: 'es2022', chunkSizeWarningLimit: 2000, reportCompressedSize: false },
  server: { port: 5304, strictPort: true, host: '127.0.0.1' },
  preview: { port: 5304, strictPort: true, host: '127.0.0.1' },
});
