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

/** Endereço do site (as tags de compartilhamento precisam de URL completa). Na Vercel vem do domínio de produção; vazio deixa o endereço relativo. */
function resolveSiteUrl() {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, "");
  return process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "";
}

export default defineConfig({
  define: {
    __BUILD_ID__: JSON.stringify(resolveBuildId()),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // Motor do tabuleiro: o mesmo arquivo roda aqui (partida local) e no servidor.
      "@board": path.resolve(__dirname, "../backend/src/board"),
      // Motor do Duelo de Cartas (treino contra bot roda aqui; o online, no servidor).
      "@duel": path.resolve(__dirname, "../backend/src/duel"),
    },
  },
  plugins: [
    { name: "site-url", transformIndexHtml: (html: string) => html.replaceAll("%SITE_URL%", resolveSiteUrl()) },
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
          "assets/logo-completa-*.webp",
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
