// Gera os ícones do PWA a partir de src/assets/simbolo.png (fundo transparente).
// Uso: npm run icons
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'src/assets/simbolo.png');
const outDir = path.join(root, 'public/icons');

// Azul-noite do tema escuro: fundo de quem não aceita transparência
// (ícone "maskable" do Android e ícone da tela inicial do iPhone).
const night = '#0a0e2c';
const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

const icons = [
  // "any" e favicon: só o símbolo, sem fundo.
  { file: 'icon-192.png', size: 192, scale: 0.94, background: transparent },
  { file: 'icon-512.png', size: 512, scale: 0.94, background: transparent },
  { file: 'favicon-32.png', size: 32, scale: 1, background: transparent },
  // "maskable": fundo cheio e símbolo dentro da zona segura (círculo de 80%).
  { file: 'icon-maskable-192.png', size: 192, scale: 0.66, background: night },
  { file: 'icon-maskable-512.png', size: 512, scale: 0.66, background: night },
  // iPhone preenche transparência de preto: fundo próprio.
  { file: 'apple-touch-icon.png', size: 180, scale: 0.8, background: night },
];

await mkdir(outDir, { recursive: true });
const trimmed = await sharp(source).trim().toBuffer();

for (const { file, size, scale, background } of icons) {
  const inner = Math.round(size * scale);
  const symbol = await sharp(trimmed).resize(inner, inner, { fit: 'contain', background: transparent }).toBuffer();

  await sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: symbol, gravity: 'center' }])
    .png({ compressionLevel: 9, palette: true, quality: 92, effort: 10 })
    .toFile(path.join(outDir, file));

  console.log(`public/icons/${file}`);
}
