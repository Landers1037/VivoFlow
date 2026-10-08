import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const proxyTarget = process.env.VIVOFLOW_PROXY_TARGET ?? "https://127.0.0.1:8787";
const wsTarget = proxyTarget.replace(/^http/i, "ws");

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/ws": {
        target: wsTarget,
        ws: true,
        secure: false,
      },
      "/api": {
        target: proxyTarget,
        changeOrigin: true,
        secure: false,
        timeout: 120000,
        proxyTimeout: 120000,
      },
    },
  },
});
