import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "node:path";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@im/shared": path.resolve(
        __dirname,
        "../../packages/shared/src/index.ts",
      ),
    },
  },
  server: {
    port: 5173,
    // Permit Vite dev server to accept requests from ngrok / LAN / preview tunnels.
    // `true` is safe here because the dev server is never exposed in production.
    allowedHosts: true,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
      // Uploaded media is served at /uploads (outside the /api prefix) by
      // ServeStaticModule in dev, so the dev proxy has to forward it too —
      // otherwise image <img src> and file <a href> 404 against the Vite
      // server.
      "/uploads": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
      "/socket.io": {
        target: "http://localhost:3001",
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
