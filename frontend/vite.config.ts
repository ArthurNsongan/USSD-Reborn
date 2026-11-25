import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// In development every backend route is proxied to FastAPI, so the browser never hits CORS.
const backend = "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    host: true, // reachable from a phone on the same Wi-Fi: http://<pc-ip>:5173/phone/
    proxy: { "/api": backend, "/ussd": backend },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // Two pages: the lab view (/) and the full-screen handset (/phone/).
    // Paths are relative to frontend/, where every npm script runs.
    rollupOptions: { input: { main: "index.html", phone: "phone/index.html" } },
  },
});
