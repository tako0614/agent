import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solid()],
  build: {
    target: 'esnext',
    outDir: 'dist'
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      }
    }
  }
});
