import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: 5173, strictPort: true },
  build: {
    outDir: 'dist/extension',
    emptyOutDir: true,
    rollupOptions: { input: { panel: resolve('panel.html'), demo: resolve('demo.html'), xDemo: resolve('x-demo.html'), recipeDemo: resolve('recipe-demo.html'), commuteDemo: resolve('commute-demo.html') } },
  },
});
