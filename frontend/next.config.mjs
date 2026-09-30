import { execSync } from 'node:child_process';

// Identifica o build; o service worker é registrado com ele na URL, então
// cada deploy instala uma nova versão do worker (e descarta caches antigos).
function resolveBuildId() {
  if (process.env.APP_BUILD_ID) {
    return process.env.APP_BUILD_ID;
  }

  // Na Vercel cada deploy tem um id próprio.
  if (process.env.VERCEL_DEPLOYMENT_ID) {
    return process.env.VERCEL_DEPLOYMENT_ID;
  }

  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() + '-' + Date.now().toString(36);
  } catch {
    return Date.now().toString(36);
  }
}

const buildId = resolveBuildId();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_BUILD_ID: buildId,
  },
  generateBuildId: async () => buildId,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          // O navegador precisa sempre buscar a versão mais nova do worker.
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
};

export default nextConfig;
