import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import path from "path";

export default defineConfig({
  root: path.resolve(__dirname),
  plugins: [solid()],
  build: {
    target: "esnext",
    // emit into the repository-level dist/client
    outDir: path.resolve(__dirname, "../dist/client"),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    // proxy API calls to Miniflare (default: 8787)
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
      },
    },
  },
});
