import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    open: true,
  },
  build: {
    target: 'es2022',
    cssMinify: 'esbuild',
    sourcemap: false,
    reportCompressedSize: true,
  },
  preview: {
    port: 4173,
  },
});
