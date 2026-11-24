import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// In development every backend route is proxied to FastAPI, so the browser never hits CORS.
const backend = "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: { "/api": backend, "/ussd": backend },
  },
  build: { outDir: "dist", emptyOutDir: true },
});
