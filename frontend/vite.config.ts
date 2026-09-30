import { execSync } from "node:child_process";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

const THEME_LIGHT = "#eef0ff";

function resolveBuildId() {
  if (process.env.VERCEL_GIT_COMMIT_SHA) {
    return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 12);
  }
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return Date.now().toString(36);
  }
}

export default defineConfig({
  define: {
    __BUILD_ID__: JSON.stringify(resolveBuildId()),
    // Com o Vercel Blob configurado (mesma variável do backend) as imagens vão
    // para o Blob; sem ele, ficam no banco como data URL (desenvolvimento).
    __IMAGE_UPLOADS__: JSON.stringify(process.env.BLOB_READ_WRITE_TOKEN ? "blob" : "inline"),
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // O próprio app registra o worker e pergunta antes de atualizar (pwa-provider.tsx).
      injectRegister: false,
      registerType: "prompt",
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      // Manifest e ícones do manifest entram no pré-cache automaticamente; estes são os demais.
      includeAssets: ["icons/apple-touch-icon.png", "icons/favicon-32.png"],
      injectManifest: {
        // Na instalação, só o essencial para abrir o app offline. Os demais pedaços
        // (painel do admin, diagramas, outros alfabetos das fontes) entram no
        // cache na primeira vez em que são usados (rota /assets/ em src/sw.ts).
        globPatterns: [
          "index.html",
          "assets/index-*.{js,css}",
          "assets/sticker-page-*.js",
          "assets/*-latin-[0-9]*-normal-*.woff2",
        ],
      },
      manifest: {
        id: "/",
        name: "Coleção Bíblica",
        short_name: "Coleção Bíblica",
        description: "Aprenda sobre a Bíblia jogando quizzes, colecionando figurinhas e subindo no ranking.",
        lang: "pt-BR",
        dir: "ltr",
        // Sem sessão, a rota manda para o login.
        start_url: "/dashboard",
        scope: "/",
        display: "standalone",
        display_override: ["standalone", "minimal-ui"],
        background_color: THEME_LIGHT,
        theme_color: THEME_LIGHT,
        categories: ["education", "games", "books"],
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:3333", changeOrigin: true },
    },
  },
  preview: {
    port: 4173,
    proxy: {
      "/api": { target: "http://localhost:3333", changeOrigin: true },
    },
  },
});
