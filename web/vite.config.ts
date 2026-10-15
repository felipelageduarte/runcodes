import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@runcodes/ui": fileURLToPath(new URL("./src/packages/ui/src", import.meta.url)),
      "@runcodes/api-client": fileURLToPath(
        new URL("./src/packages/api-client/src", import.meta.url),
      ),
      "@runcodes/auth": fileURLToPath(new URL("./src/packages/auth/src", import.meta.url)),
      "@runcodes/shared": fileURLToPath(new URL("./src/packages/shared/src", import.meta.url)),
      "@runcodes/editor": fileURLToPath(new URL("./src/packages/editor/src", import.meta.url)),
    },
  },
  server: {
    proxy: {
      "/api": { target: "http://localhost:3000", changeOrigin: true },
      // Site de documentação (Docusaurus) servido pela API — manual
      // público + admin-docs atrás de sessão (iframe do painel admin).
      "/docs": { target: "http://localhost:3000", changeOrigin: true },
    },
  },
});
